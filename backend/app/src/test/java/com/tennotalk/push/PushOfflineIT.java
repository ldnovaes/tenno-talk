package com.tennotalk.push;

import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.SecureRandom;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import com.sun.net.httpserver.HttpServer;
import com.tennotalk.support.IntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A new message reaches a device with the app closed. The shared test context has no VAPID keys,
 * so this builds its own {@link PushDelivery} with a throwaway pair and a local push endpoint.
 */
class PushOfflineIT extends IntegrationTest {

    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();

    private HttpServer endpoint;
    private final List<String> received = new CopyOnWriteArrayList<>();
    private PushDelivery delivery;

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
            received.add(exchange.getRequestHeaders().getFirst("Content-Encoding"));
            exchange.getRequestBody().readAllBytes();
            exchange.sendResponseHeaders(201, -1);
            exchange.close();
        });
        endpoint.start();
        KeyPair vapid = p256();
        String publicKey = uncompressed(vapid);
        String privateKey = B64.encodeToString(unsigned32(((ECPrivateKey) vapid.getPrivate()).getS()));
        delivery = new PushDelivery(jdbc, new PushSubscriptions(jdbc, publicKey, privateKey), json,
                publicKey, privateKey, "mailto:test@example.com");
    }

    @AfterEach
    void stopEndpoint() {
        endpoint.stop(0);
    }

    /** Inserted directly: the API accepts only real push services, and this endpoint is local. */
    private void subscribe(UUID user) throws Exception {
        byte[] auth = new byte[16];
        new SecureRandom().nextBytes(auth);
        jdbc.sql("INSERT INTO push_subscriptions(id, user_id, endpoint, p256dh, auth) VALUES (:id, :u, :e, :k, :a)")
                .param("id", UUID.randomUUID()).param("u", user)
                .param("e", "http://127.0.0.1:" + endpoint.getAddress().getPort() + "/push/" + user)
                .param("k", uncompressed(p256())).param("a", B64.encodeToString(auth)).update();
    }

    private UUID newMessageNotificationOf(UUID recipient) {
        return jdbc.sql("SELECT id FROM notifications WHERE recipient_id = :u AND type = 'new_message'")
                .param("u", recipient).query(UUID.class).single();
    }

    @Test
    void aNewMessageIsPushedToTheRecipientsSubscribedDevice() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR"), linh = data.user("linh", "vi-VN");
        subscribe(linh);
        steps.send(rafael, steps.direct(rafael, linh), "Oi!");

        UUID notification = newMessageNotificationOf(linh);
        delivery.enqueue(notification);
        delivery.run();

        assertThat(received).containsExactly("aes128gcm");
        assertThat(jdbc.sql("SELECT count(*) FROM push_deliveries WHERE notification_id = :n").param("n", notification)
                .query(Long.class).single()).isOne();
    }

    @Test
    void withoutASubscriptionThereIsNothingToDeliver() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR"), linh = data.user("linh", "vi-VN");
        steps.send(rafael, steps.direct(rafael, linh), "Oi!");

        delivery.enqueue(newMessageNotificationOf(linh));
        delivery.run();

        assertThat(received).isEmpty();
    }

    @Test
    void turningMessageNotificationsOffStopsThePush() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR"), linh = data.user("linh", "vi-VN");
        subscribe(linh);
        UUID conversation = steps.direct(rafael, linh);
        steps.send(rafael, conversation, "Oi!");
        UUID notification = newMessageNotificationOf(linh);
        data.setPreference(linh, "notify_messages", false);

        delivery.enqueue(notification);
        delivery.run();

        assertThat(received).isEmpty();
    }
}
