package com.tennotalk.push;

import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import com.sun.net.httpserver.HttpServer;
import com.tennotalk.support.IntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Web Push with the app closed (PLAN.md §31.1 "Notificações e push"). The shared test context has no VAPID keys,
 * so this builds its own {@link PushDelivery} with a throwaway pair and a local push service that answers what each
 * test wants.
 */
class PushDeliveryIT extends IntegrationTest {

    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();

    private HttpServer endpoint;
    /** Device name → every Content-Encoding received (one per push). */
    private final Map<String, List<String>> received = new ConcurrentHashMap<>();
    /** Device name → HTTP status the push service answers (201 by default). */
    private final Map<String, Integer> answers = new ConcurrentHashMap<>();
    private PushDelivery delivery;

    private UUID owner;
    private UUID actor;

    private static byte[] unsigned32(BigInteger value) {
        byte[] raw = value.toByteArray();
        byte[] out = new byte[32];
        System.arraycopy(raw, Math.max(0, raw.length - 32), out, Math.max(0, 32 - raw.length), Math.min(32, raw.length));
        return out;
    }

    private static KeyPair p256() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        return generator.generateKeyPair();
    }

    private static String uncompressed(KeyPair pair) {
        var point = ((ECPublicKey) pair.getPublic()).getW();
        byte[] key = new byte[65];
        key[0] = 4;
        System.arraycopy(unsigned32(point.getAffineX()), 0, key, 1, 32);
        System.arraycopy(unsigned32(point.getAffineY()), 0, key, 33, 32);
        return B64.encodeToString(key);
    }

    @BeforeEach
    void pushInfrastructure() throws Exception {
        endpoint = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        endpoint.createContext("/", exchange -> {
            String device = exchange.getRequestURI().getPath().substring("/push/".length());
            received.computeIfAbsent(device, key -> new CopyOnWriteArrayList<>())
                    .add(exchange.getRequestHeaders().getFirst("Content-Encoding"));
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(answers.getOrDefault(device, 201), -1);
            exchange.close();
        });
        endpoint.start();
        KeyPair vapid = p256();
        String publicKey = uncompressed(vapid);
        String privateKey = B64.encodeToString(unsigned32(((ECPrivateKey) vapid.getPrivate()).getS()));
        delivery = new PushDelivery(jdbc, new PushSubscriptions(jdbc, publicKey, privateKey), json,
                publicKey, privateKey, "mailto:test@example.com");
        owner = data.user("owner", "pt-BR");
        actor = data.user("ana", "es-ES");
    }

    @AfterEach
    void stopEndpoint() {
        endpoint.stop(0);
    }

    /** Inserted directly: the API accepts only real push services, and this endpoint is local. */
    private UUID subscribe(UUID user, String device) throws Exception {
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO push_subscriptions(id, user_id, endpoint, p256dh, auth) VALUES (:id, :u, :e, :k, :a)")
                .param("id", id).param("u", user)
                .param("e", "http://127.0.0.1:" + endpoint.getAddress().getPort() + "/push/" + device)
                .param("k", uncompressed(p256())).param("a", B64.encodeToString(auth)).update();
        return id;
    }

    private int pushesTo(String device) {
        return received.getOrDefault(device, List.of()).size();
    }

    private UUID notificationOf(String type) throws Exception {
        return actions.notify(actor, owner, type).orElseThrow();
    }

    private void dispatch(UUID notification) {
        delivery.enqueue(notification);
        delivery.run();
    }

    // ---- Preferences: each type is gated by its own switch (PLAN.md §31.1) ----

    @ParameterizedTest(name = "{0}: pushed while on, silent once off")
    @org.junit.jupiter.params.provider.FieldSource("com.tennotalk.support.Actions#NOTIFICATION_TYPES")
    void eachTypeFollowsItsOwnPreference(String type) throws Exception {
        String preference = com.tennotalk.support.Actions.preferenceOf(type);
        subscribe(owner, "phone");
        UUID on = notificationOf(type);
        dispatch(on);
        assertThat(pushesTo("phone")).as("pushed while on").isEqualTo(1);
        assertThat(received.get("phone")).containsOnly("aes128gcm");

        // Turned off after the notification was created but before the push left: nothing is sent.
        jdbc.sql("DELETE FROM notifications").update();
        jdbc.sql("DELETE FROM follows").update();
        jdbc.sql("DELETE FROM follow_requests").update();
        data.setPreference(owner, "profile_visibility", "public");
        data.setPreference(actor, "profile_visibility", "public");
        UUID off = notificationOf(type);
        data.setPreference(owner, preference, false);
        dispatch(off);
        assertThat(pushesTo("phone")).as("silent while off").isEqualTo(1);
    }

    // ---- Nothing is pushed that the in-app list would not show ----

    @Test
    void aNotificationReadBeforeThePushLeavesIsNotPushed() throws Exception {
        subscribe(owner, "phone");
        UUID notification = notificationOf("like");
        api.post(owner, "/api/notifications/read-all", null).andExpect(status().is2xxSuccessful());
        dispatch(notification);
        assertThat(pushesTo("phone")).isZero();
    }

    @Test
    void aNotificationOlderThanADayIsNotPushed() throws Exception {
        subscribe(owner, "phone");
        UUID notification = notificationOf("like");
        jdbc.sql("UPDATE notifications SET created_at = :at WHERE id = :id")
                .param("at", Timestamp.from(Instant.now().minus(25, ChronoUnit.HOURS))).param("id", notification).update();
        dispatch(notification);
        assertThat(pushesTo("phone")).isZero();
    }

    @ParameterizedTest(name = "blocked by the {0}")
    @ValueSource(strings = {"owner", "actor"})
    void neverBetweenABlockedPair(String blocker) throws Exception {
        subscribe(owner, "phone");
        UUID notification = notificationOf("new_message");
        if (blocker.equals("owner")) data.block(owner, actor);
        else data.block(actor, owner);
        dispatch(notification);
        assertThat(pushesTo("phone")).isZero();
    }

    @Test
    void aMutedConversationIsNotPushed() throws Exception {
        subscribe(owner, "phone");
        UUID notification = notificationOf("new_message");
        UUID conversation = jdbc.sql("SELECT conversation_id FROM notifications WHERE id = :id").param("id", notification)
                .query(UUID.class).single();
        jdbc.sql("UPDATE conversation_members SET muted_until = now() + interval '1 day' WHERE conversation_id = :c AND user_id = :u")
                .param("c", conversation).param("u", owner).update();
        dispatch(notification);
        assertThat(pushesTo("phone")).isZero();
    }

    @Test
    void withoutASubscriptionThereIsNothingToDeliver() throws Exception {
        dispatch(notificationOf("new_message"));
        assertThat(received).isEmpty();
        assertThat(jdbc.sql("SELECT count(*) FROM push_jobs").query(Long.class).single()).isZero();
    }

    // ---- Devices and the push services' answers ----

    @Test
    void everyDeviceOfTheRecipientGetsItOnceAndNobodyElse() throws Exception {
        subscribe(owner, "phone");
        subscribe(owner, "laptop");
        subscribe(actor, "actor-phone");
        UUID notification = notificationOf("new_message");
        dispatch(notification);
        dispatch(notification);
        assertThat(pushesTo("phone")).isOne();
        assertThat(pushesTo("laptop")).isOne();
        assertThat(pushesTo("actor-phone")).isZero();
        assertThat(jdbc.sql("SELECT count(*) FROM push_deliveries WHERE notification_id = :n").param("n", notification)
                .query(Long.class).single()).isEqualTo(2);
    }

    @ParameterizedTest(name = "HTTP {0} removes the dead subscription")
    @ValueSource(ints = {404, 410})
    void anExpiredSubscriptionIsRemoved(int answer) throws Exception {
        UUID dead = subscribe(owner, "old-phone");
        subscribe(owner, "phone");
        answers.put("old-phone", answer);
        dispatch(notificationOf("new_message"));
        assertThat(jdbc.sql("SELECT count(*) FROM push_subscriptions WHERE id = :id").param("id", dead).query(Long.class).single()).isZero();
        assertThat(pushesTo("phone")).isOne();
        assertThat(jdbc.sql("SELECT count(*) FROM push_jobs").query(Long.class).single()).isZero();
    }

    @Test
    void aFailingPushServiceIsRetriedLaterWithoutRepeatingDeliveredDevices() throws Exception {
        subscribe(owner, "phone");
        subscribe(owner, "laptop");
        answers.put("laptop", 503);
        UUID notification = notificationOf("new_message");
        dispatch(notification);

        var job = jdbc.sql("SELECT attempts, available_at > now() AS later FROM push_jobs WHERE notification_id = :n")
                .param("n", notification).query((rs, i) -> Map.of("attempts", rs.getInt("attempts"), "later", rs.getBoolean("later")))
                .single();
        assertThat(job).containsEntry("attempts", 1).containsEntry("later", true);

        answers.put("laptop", 201);
        jdbc.sql("UPDATE push_jobs SET available_at = now()").update();
        delivery.run();
        assertThat(pushesTo("phone")).as("not pushed twice").isOne();
        assertThat(pushesTo("laptop")).as("one refused, one delivered").isEqualTo(2);
        assertThat(jdbc.sql("SELECT count(*) FROM push_jobs").query(Long.class).single()).isZero();
    }

    @Test
    void aBurstIsDeliveredInOneRunNotOnePerSecond() throws Exception {
        subscribe(owner, "phone");
        UUID conversation = steps.direct(actor, owner);
        for (int n = 0; n < 5; n++) steps.send(actor, conversation, "Mensaje " + n);
        jdbc.sql("SELECT id FROM notifications WHERE recipient_id = :u").param("u", owner).query(UUID.class).list()
                .forEach(delivery::enqueue);
        delivery.run();
        assertThat(pushesTo("phone")).isEqualTo(
                jdbc.sql("SELECT count(*) FROM notifications WHERE recipient_id = :u").param("u", owner).query(Long.class).single().intValue());
        assertThat(jdbc.sql("SELECT count(*) FROM push_jobs").query(Long.class).single()).isZero();
    }

    // ---- The API (the shared context has no VAPID keys: push is off) ----

    @Test
    void withoutVapidKeysPushIsOffAndSubscribingIsRefused() throws Exception {
        api.get(owner, "/api/push/config").andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false)).andExpect(jsonPath("$.publicKey").value(""));
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);
        api.post(owner, "/api/push/subscriptions", Map.of("endpoint", "https://fcm.googleapis.com/fcm/send/x",
                        "keys", Map.of("p256dh", uncompressed(p256()), "auth", B64.encodeToString(auth))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value("Push notifications are not configured."));
    }

    @Test
    void unsubscribingRemovesOnlyYourOwnDevice() throws Exception {
        subscribe(owner, "phone");
        String endpointUrl = "http://127.0.0.1:" + endpoint.getAddress().getPort() + "/push/phone";
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/push/subscriptions")
                        .with(com.tennotalk.support.TestData.as(actor))
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType("application/json").content(json.writeValueAsString(Map.of("endpoint", endpointUrl))))
                .andExpect(status().isNoContent());
        assertThat(jdbc.sql("SELECT count(*) FROM push_subscriptions").query(Long.class).single()).isOne();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/push/subscriptions")
                        .with(com.tennotalk.support.TestData.as(owner))
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType("application/json").content(json.writeValueAsString(Map.of("endpoint", endpointUrl))))
                .andExpect(status().isNoContent());
        assertThat(jdbc.sql("SELECT count(*) FROM push_subscriptions").query(Long.class).single()).isZero();
    }

    @Test
    void aBrowserSubscriptionMovesToTheAccountNowSignedIn() throws Exception {
        KeyPair vapid = p256();
        String publicKey = uncompressed(vapid);
        String privateKey = B64.encodeToString(unsigned32(((ECPrivateKey) vapid.getPrivate()).getS()));
        var subscriptions = new PushSubscriptions(jdbc, publicKey, privateKey);
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);
        String endpointUrl = "https://fcm.googleapis.com/fcm/send/shared-laptop";
        subscriptions.subscribe(owner, endpointUrl, uncompressed(p256()), B64.encodeToString(auth));
        subscriptions.subscribe(actor, endpointUrl, uncompressed(p256()), B64.encodeToString(auth));
        assertThat(subscriptions.forUser(owner)).isEmpty();
        assertThat(subscriptions.forUser(actor)).hasSize(1);
    }
}
