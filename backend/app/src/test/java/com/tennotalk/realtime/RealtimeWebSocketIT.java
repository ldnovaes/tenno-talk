package com.tennotalk.realtime;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.tennotalk.support.IntegrationTest;
import com.tennotalk.translation.TranslationWorker;

import tools.jackson.databind.JsonNode;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** A real server and real sockets, authenticated by the session cookie (PLAN.md §26). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RealtimeWebSocketIT extends IntegrationTest {

    private static final String ORIGIN = "http://localhost:5173";

    @LocalServerPort
    int port;

    @Autowired
    PasswordEncoder passwords;

    @Autowired
    TranslationWorker worker;

    private UUID rafael;
    private UUID linh;
    private UUID conversation;
    private final java.util.List<Client> clients = new java.util.ArrayList<>();

    /** One connected device; frames are kept in arrival order. */
    final class Client extends TextWebSocketHandler {
        final BlockingQueue<JsonNode> frames = new LinkedBlockingQueue<>();
        WebSocketSession session;
        volatile CloseStatus closed;

        @Override
        public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            closed = status;
        }

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            frames.add(json.readTree(message.getPayload()));
        }

        JsonNode next(String type) throws InterruptedException {
            return next(type, payload -> true);
        }

        JsonNode next(String type, java.util.function.Predicate<JsonNode> matching) throws InterruptedException {
            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
            while (System.nanoTime() < deadline) {
                JsonNode frame = frames.poll(100, TimeUnit.MILLISECONDS);
                if (frame != null && type.equals(frame.get("type").asString()) && matching.test(frame.get("payload"))) {
                    return frame.get("payload");
                }
            }
            throw new AssertionError("No " + type + " frame arrived");
        }

        /** Waits a little and fails if a frame of this type arrived (for "never sent" rules). */
        void none(String type) throws InterruptedException {
            Thread.sleep(700);
            assertThat(frames.stream().map(f -> f.get("type").asString())).as("no " + type).doesNotContain(type);
        }

        void sendRaw(String text) throws Exception {
            session.sendMessage(new TextMessage(text));
        }
    }

    @BeforeEach
    void people() {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
        data.password(rafael, passwords.encode("secret123"));
        data.password(linh, passwords.encode("secret123"));
    }

    @AfterEach
    void disconnect() throws Exception {
        for (Client client : clients) {
            if (client.session != null && client.session.isOpen()) client.session.close();
        }
    }

    private String sessionOf(String username) throws Exception {
        return sessionCookie(mvc.perform(withJson(post("/api/auth/signin"),
                        Map.of("email", username + "@example.com", "password", "secret123")))
                .andExpect(status().isOk()).andReturn()).getValue();
    }

    private Client connect(String sessionCookie, String origin) throws Exception {
        Client client = new Client();
        WebSocketHttpHeaders headers = new WebSocketHttpHeaders();
        if (sessionCookie != null) headers.add("Cookie", "SESSION=" + sessionCookie);
        if (origin != null) headers.setOrigin(origin);
        client.session = new StandardWebSocketClient()
                .execute(client, headers, URI.create("ws://localhost:" + port + "/ws"))
                .get(5, TimeUnit.SECONDS);
        clients.add(client);
        return client;
    }

    private Client connect(String username) throws Exception {
        return connect(sessionOf(username), ORIGIN);
    }

    // ---- limits and session endings (PLAN.md §38) ---------------------------------------

    private void signOut(String session) throws Exception {
        mvc.perform(post("/api/auth/signout").cookie(new jakarta.servlet.http.Cookie("SESSION", session))
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isNoContent());
    }

    @Test
    void aSocketFloodingFramesIsClosed() throws Exception {
        Client device = connect("rafael");
        for (int i = 0; i < RealtimeWebSocketHandler.FRAMES_PER_WINDOW + 5 && device.session.isOpen(); i++) {
            device.sendRaw("{\"type\":\"ping\",\"payload\":{}}");
        }
        await().atMost(Duration.ofSeconds(5)).until(() -> device.closed != null);
        assertThat(device.closed.getCode()).isEqualTo(CloseStatus.POLICY_VIOLATION.getCode());
    }

    @Test
    void aNormalClientIsNeverClosed() throws Exception {
        Client device = connect("rafael");
        for (int i = 0; i < 10; i++) device.sendRaw("{\"type\":\"ping\",\"payload\":{}}");
        for (int i = 0; i < 10; i++) device.next("pong");
        assertThat(device.session.isOpen()).isTrue();
    }

    @Test
    void theEleventhSocketOfAPersonClosesTheOldest() throws Exception {
        String session = sessionOf("rafael");
        List<Client> devices = new java.util.ArrayList<>();
        for (int i = 0; i < RealtimeHub.MAX_SOCKETS_PER_USER + 1; i++) devices.add(connect(session, ORIGIN));
        await().atMost(Duration.ofSeconds(5)).until(() -> devices.getFirst().closed != null);
        assertThat(devices.subList(1, devices.size())).allSatisfy(device -> assertThat(device.session.isOpen()).isTrue());
    }

    @Test
    void signingOutClosesOnlyThatBrowsersSockets() throws Exception {
        String laptop = sessionOf("rafael");
        String phone = sessionOf("rafael");
        Client laptopSocket = connect(laptop, ORIGIN);
        Client phoneSocket = connect(phone, ORIGIN);

        signOut(laptop);

        await().atMost(Duration.ofSeconds(5)).until(() -> laptopSocket.closed != null);
        assertThat(phoneSocket.session.isOpen()).isTrue();
    }

    @Test
    void changingThePasswordEndsEveryOtherSessionAndItsSockets() throws Exception {
        String laptop = sessionOf("rafael");
        String stolen = sessionOf("rafael");
        Client laptopSocket = connect(laptop, ORIGIN);
        Client stolenSocket = connect(stolen, ORIGIN);

        mvc.perform(withJson(post("/api/auth/password"), Map.of("current", "secret123", "next", "newsecret1"))
                        .cookie(new jakarta.servlet.http.Cookie("SESSION", laptop))
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()))
                .andExpect(status().isNoContent());

        await().atMost(Duration.ofSeconds(5)).until(() -> stolenSocket.closed != null);
        assertThat(laptopSocket.session.isOpen()).isTrue();
        assertThat(sessionUser(stolen)).as("the other session is gone").isNull();
        assertThat(sessionUser(laptop)).isEqualTo(rafael.toString());
        assertThatThrownBy(() -> connect(stolen, ORIGIN)).hasStackTraceContaining("401");
    }

    private String sessionUser(String session) throws Exception {
        JsonNode body = json.readTree(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/auth/session")
                .cookie(new jakarta.servlet.http.Cookie("SESSION", session))).andReturn().getResponse().getContentAsString());
        return body.get("userId").isNull() ? null : body.get("userId").asString();
    }

    @Test
    void anonymousSocketsAreRejected() {
        assertThatThrownBy(() -> connect(null, ORIGIN)).hasStackTraceContaining("401");
    }

    @Test
    void foreignOriginsAreRejected() throws Exception {
        String session = sessionOf("rafael");
        assertThatThrownBy(() -> connect(session, "https://evil.example.com")).hasStackTraceContaining("403");
    }

    @Test
    void forgedSessionCookiesAreRejected() {
        assertThatThrownBy(() -> connect("bm90LWEtc2Vzc2lvbg", ORIGIN)).hasStackTraceContaining("401");
    }

    @Test
    void newMessagesArriveAndTheSenderSeesThemDelivered() throws Exception {
        conversation = steps.direct(rafael, linh);
        Client rafaelDevice = connect("rafael");
        Client linhDevice = connect("linh");

        JsonNode sent = steps.send(rafael, conversation, "Oi, tudo bem?");

        JsonNode created = linhDevice.next("message.created").get("message");
        assertThat(created.get("id").asString()).isEqualTo(sent.get("id").asString());
        assertThat(created.at("/content/body/text").asString()).isEqualTo("Oi, tudo bem?");
        assertThat(created.at("/translation/status").asString()).isEqualTo("pending");

        assertThat(rafaelDevice.next("message.created").at("/message/clientId").asString()).isEqualTo(sent.get("clientId").asString());
        assertThat(steps.lastMessage(rafael, conversation).get("deliveryStatus").asString()).isEqualTo("sent");
        api.post(linh, "/api/conversations/" + conversation + "/delivered", Map.of("messageIds", List.of(sent.get("id").asString())))
                .andExpect(status().isNoContent());
        JsonNode delivered = rafaelDevice.next("message.updated");
        assertThat(delivered.at("/message/deliveryStatus").asString()).isEqualTo("delivered");
    }

    @Test
    void translationsArriveWhenTheWorkerFinishes() throws Exception {
        conversation = steps.direct(rafael, linh);
        Client linhDevice = connect("linh");
        JsonNode sent = steps.send(rafael, conversation, "Bom dia");
        linhDevice.next("message.created");

        worker.runOnce();

        // Queued events project the latest state; intermediate states may be coalesced.
        JsonNode update = linhDevice.next("translation.updated", p -> p.at("/translation/status").asString().equals("translated"));
        assertThat(update.get("messageId").asString()).isEqualTo(sent.get("id").asString());
        assertThat(update.at("/translation/text").asString()).isEqualTo("[Vietnamese (Vietnam)] Bom dia");
        assertThat(update.at("/translation/version").asInt()).isOne();
    }

    @Test
    void readReceiptsReachTheSender() throws Exception {
        conversation = steps.direct(rafael, linh);
        Client rafaelDevice = connect("rafael");
        JsonNode sent = steps.send(rafael, conversation, "Oi");
        api.post(linh, "/api/conversations/" + conversation + "/read", Map.of("messageId", sent.get("id").asString()))
                .andExpect(status().isNoContent());
        JsonNode read = rafaelDevice.next("message.read");
        assertThat(read.get("readerId").asString()).isEqualTo(linh.toString());
    }

    @Test
    void typingIsRelayedToTheOtherMembersOnly() throws Exception {
        conversation = steps.direct(rafael, linh);
        Client rafaelDevice = connect("rafael");
        Client linhDevice = connect("linh");
        linhDevice.sendRaw(json.writeValueAsString(Map.of("type", "typing", "conversationId", conversation, "isTyping", true)));

        JsonNode typing = rafaelDevice.next("typing.started");
        assertThat(typing.get("userId").asString()).isEqualTo(linh.toString());
        assertThat(typing.get("conversationId").asString()).isEqualTo(conversation.toString());

        linhDevice.sendRaw(json.writeValueAsString(Map.of("type", "typing", "conversationId", conversation, "isTyping", false)));
        rafaelDevice.next("typing.stopped");
        assertThat(linhDevice.frames.stream().map(f -> f.get("type").asString())).doesNotContain("typing.started");
    }

    @Test
    void outsidersCannotFakeTypingInOtherConversations() throws Exception {
        conversation = steps.direct(rafael, linh);
        UUID ana = data.user("ana", "es-ES");
        data.password(ana, passwords.encode("secret123"));
        Client rafaelDevice = connect("rafael");
        Client anaDevice = connect("ana");
        anaDevice.sendRaw(json.writeValueAsString(Map.of("type", "typing", "conversationId", conversation, "isTyping", true)));
        Thread.sleep(300);
        assertThat(rafaelDevice.frames.stream().map(f -> f.get("type").asString())).doesNotContain("typing.started");
    }

    @Test
    void pingsAreAnsweredForTheHeartbeat() throws Exception {
        Client linhDevice = connect("linh");
        linhDevice.sendRaw("{\"type\":\"ping\"}");
        assertThat(linhDevice.next("pong").isObject()).isTrue();
    }

    @Test
    void garbageFramesAreIgnored() throws Exception {
        Client linhDevice = connect("linh");
        linhDevice.sendRaw("not json");
        linhDevice.sendRaw("{\"type\":\"unknown\"}");
        Thread.sleep(200);
        assertThat(linhDevice.session.isOpen()).isTrue();
    }

    @Test
    void contactsSeeYouComeOnlineAndLeave() throws Exception {
        conversation = steps.direct(rafael, linh);
        Client rafaelDevice = connect("rafael");
        Client linhDevice = connect("linh");
        assertThat(rafaelDevice.next("user.online").get("userId").asString()).isEqualTo(linh.toString());

        linhDevice.session.close(CloseStatus.NORMAL);
        JsonNode offline = rafaelDevice.next("user.offline");
        assertThat(offline.get("userId").asString()).isEqualTo(linh.toString());
        assertThat(offline.get("lastSeenAt").asString()).isNotBlank();
    }

    @Test
    void hiddenPresenceIsNeverPushed() throws Exception {
        conversation = steps.direct(rafael, linh);
        data.setPreference(linh, "who_can_see_online", "nobody");
        Client rafaelDevice = connect("rafael");
        Client linhDevice = connect("linh");
        assertThat(api.getOk(rafael, "/api/profiles/linh").get("isOnline").asBoolean()).isFalse();

        linhDevice.session.close(CloseStatus.NORMAL);
        Thread.sleep(500);
        assertThat(rafaelDevice.frames.stream().map(f -> f.get("type").asString())).doesNotContain("user.online", "user.offline");
        assertThat(api.getOk(rafael, "/api/profiles/linh").get("lastSeenAt").isNull()).isTrue();
    }

    @Test
    void onlyPeopleTheOwnerFollowsSeeThemOnlineWithFollowers() throws Exception {
        UUID ana = data.user("ana", "es-ES");
        data.password(ana, passwords.encode("secret123"));
        steps.direct(rafael, linh);
        steps.direct(ana, linh);
        data.setPreference(linh, "who_can_see_online", "followers");
        data.follow(linh, rafael);
        Client rafaelDevice = connect("rafael");
        Client anaDevice = connect("ana");
        connect("linh");

        assertThat(rafaelDevice.next("user.online", p -> p.get("userId").asString().equals(linh.toString()))).isNotNull();
        assertThat(api.getOk(rafael, "/api/profiles/linh").get("isOnline").asBoolean()).isTrue();
        assertThat(api.getOk(ana, "/api/profiles/linh").get("isOnline").asBoolean()).isFalse();
        Thread.sleep(300);
        assertThat(anaDevice.frames.stream().filter(f -> "user.online".equals(f.get("type").asString()))
                .map(f -> f.at("/payload/userId").asString())).doesNotContain(linh.toString());
    }

    @Test
    void onlineStatusShowsInProfiles() throws Exception {
        steps.direct(rafael, linh);
        connect("linh");
        await().atMost(Duration.ofSeconds(5)).until(() ->
                api.getOk(rafael, "/api/profiles/linh").get("isOnline").asBoolean());
    }

    @Test
    void notificationsArePushedLive() throws Exception {
        Client rafaelDevice = connect("rafael");
        api.put(linh, "/api/profiles/" + rafael + "/follow").andExpect(status().isOk());
        JsonNode pushed = rafaelDevice.next("notification.created").get("notification");
        assertThat(pushed.get("type").asString()).isEqualTo("follow");
        assertThat(pushed.at("/actor/username").asString()).isEqualTo("linh");
    }

    @Test
    void anOnlineRecipientGetsWhatRaisesTheChatAndNotificationBadges() throws Exception {
        conversation = steps.direct(rafael, linh);
        // Two devices: next() skips other frames, and the two events may arrive in either order.
        Client forChats = connect("linh");
        Client forNotifications = connect("linh");
        String sent = steps.send(rafael, conversation, "Oi").get("id").asString();

        assertThat(forChats.next("message.created").at("/message/id").asString()).isEqualTo(sent);
        JsonNode notification = forNotifications.next("notification.created", payload ->
                "new_message".equals(payload.at("/notification/type").asString())).get("notification");
        assertThat(notification.get("messageId").asString()).isEqualTo(sent);
        assertThat(notification.get("conversationId").asString()).isEqualTo(conversation.toString());
    }

    @Test
    void everyDeviceOfAUserReceivesEvents() throws Exception {
        conversation = steps.direct(rafael, linh);
        Client phone = connect("linh");
        Client laptop = connect("linh");
        steps.send(rafael, conversation, "Oi");
        phone.next("message.created");
        laptop.next("message.created");
    }

    // ---- Blocks inside a shared group (PLAN.md §31.1 "Grupos") -----------------

    private UUID groupWithAna(UUID ana) throws Exception {
        return UUID.fromString(api.postOk(ana, "/api/conversations/groups",
                Map.of("title", "Viagem", "memberIds", List.of(rafael, linh))).get("id").asString());
    }

    @Test
    void inAGroupABlockedPairStillGetsMessagesButNoTypingReceiptsOrReactionsFromEachOther() throws Exception {
        UUID ana = data.user("ana", "es-ES");
        data.password(ana, passwords.encode("secret123"));
        UUID group = groupWithAna(ana);
        data.block(rafael, linh);
        Client rafaelDevice = connect("rafael");
        Client linhDevice = connect("linh");
        Client anaDevice = connect("ana");

        String fromLinh = steps.send(linh, group, "Xin chào").get("id").asString();
        rafaelDevice.next("message.created");
        anaDevice.next("message.created");

        linhDevice.sendRaw(json.writeValueAsString(Map.of("type", "typing", "conversationId", group, "isTyping", true)));
        anaDevice.next("typing.started");
        rafaelDevice.none("typing.started");

        api.post(ana, "/api/messages/" + fromLinh + "/reactions", Map.of("emoji", "❤️")).andExpect(status().is2xxSuccessful());
        api.post(rafael, "/api/messages/" + fromLinh + "/reactions", Map.of("emoji", "👍")).andExpect(status().is2xxSuccessful());
        linhDevice.next("reaction.created", p -> p.get("userId").asString().equals(ana.toString()));
        anaDevice.next("reaction.created", p -> p.get("userId").asString().equals(rafael.toString()));
        Thread.sleep(700);
        assertThat(linhDevice.frames.stream().filter(f -> f.get("type").asString().equals("reaction.created"))
                .map(f -> f.at("/payload/userId").asString())).doesNotContain(rafael.toString());

        api.post(rafael, "/api/conversations/" + group + "/read", Map.of("messageId", fromLinh)).andExpect(status().isNoContent());
        anaDevice.next("message.read", p -> p.get("readerId").asString().equals(rafael.toString()));
        linhDevice.none("message.read");
    }

    @Test
    void eachMemberGetsOnlyTheTranslationIntoTheirOwnLanguage() throws Exception {
        UUID ana = data.user("ana", "es-ES");
        data.password(ana, passwords.encode("secret123"));
        UUID group = groupWithAna(ana);
        Client rafaelDevice = connect("rafael");
        Client anaDevice = connect("ana");
        steps.send(linh, group, "Xin chào");
        rafaelDevice.next("message.created");
        anaDevice.next("message.created");

        worker.runOnce();
        worker.runOnce();

        JsonNode forRafael = rafaelDevice.next("translation.updated", p -> p.at("/translation/status").asString().equals("translated"));
        JsonNode forAna = anaDevice.next("translation.updated", p -> p.at("/translation/status").asString().equals("translated"));
        assertThat(forRafael.at("/translation/targetLanguage").asString()).isEqualTo("pt-BR");
        assertThat(forAna.at("/translation/targetLanguage").asString()).isEqualTo("es-ES");
        Thread.sleep(500);
        assertThat(rafaelDevice.frames.stream().filter(f -> f.get("type").asString().equals("translation.updated"))
                .map(f -> f.at("/payload/translation/targetLanguage").asString())).doesNotContain("es-ES");
    }

    @Test
    void deliveryReachesTheSenderButNotAcrossABlock() throws Exception {
        conversation = data.directConversation(rafael, linh);
        Client rafaelDevice = connect("rafael");
        String sent = steps.send(rafael, conversation, "Oi").get("id").asString();
        api.post(linh, "/api/conversations/" + conversation + "/delivered", Map.of("messageIds", List.of(sent)))
                .andExpect(status().isNoContent());
        // Per-message receipts (V5): the sender's bubble changes through message.updated.
        assertThat(rafaelDevice.next("message.updated").at("/message/deliveryStatus").asString()).isEqualTo("delivered");

        data.block(linh, rafael);
        String older = jdbc.sql("SELECT id::text FROM messages WHERE conversation_id = :c").param("c", conversation).query(String.class).single();
        rafaelDevice.frames.clear();
        api.post(linh, "/api/conversations/" + conversation + "/read", Map.of("messageId", older)).andExpect(status().isNoContent());
        rafaelDevice.none("message.read");
        rafaelDevice.none("message.updated");
        assertThat(steps.lastMessage(rafael, conversation).get("deliveryStatus").asString())
                .as("no read mark across a block, also after a refetch").isEqualTo("delivered");
        JsonNode members = api.getOk(rafael, "/api/conversations/" + conversation).get("members");
        for (JsonNode member : members) {
            if (member.at("/user/id").asString().equals(linh.toString())) {
                assertThat(member.get("lastReadMessageId").isNull()).as("linh's read position is hidden from rafael").isTrue();
            }
        }
        JsonNode linhSees = api.getOk(linh, "/api/conversations/" + conversation).get("members");
        for (JsonNode member : linhSees) {
            if (member.at("/user/id").asString().equals(linh.toString())) {
                assertThat(member.get("lastReadMessageId").asString()).as("linh still sees her own").isEqualTo(older);
            }
        }
    }

    @Test
    void readingNotificationsOnOneDeviceClearsTheBadgeOnTheOthers() throws Exception {
        Client phone = connect("rafael");
        Client laptop = connect("rafael");
        api.put(linh, "/api/profiles/" + rafael + "/follow").andExpect(status().is2xxSuccessful());
        phone.next("notification.created");
        laptop.next("notification.created");

        api.post(rafael, "/api/notifications/read-all", null).andExpect(status().is2xxSuccessful());

        phone.next("notifications.read");
        laptop.next("notifications.read");
    }

    @Test
    void closingOneOfTwoTabsDoesNotSayOffline() throws Exception {
        conversation = steps.direct(rafael, linh);
        Client rafaelDevice = connect("rafael");
        Client linhPhone = connect("linh");
        Client linhLaptop = connect("linh");
        linhPhone.session.close();
        rafaelDevice.none("user.offline");
        linhLaptop.session.close();
        assertThat(rafaelDevice.next("user.offline").get("userId").asString()).isEqualTo(linh.toString());
    }
}
