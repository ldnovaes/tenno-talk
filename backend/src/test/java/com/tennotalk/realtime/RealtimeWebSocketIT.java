package com.tennotalk.realtime;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
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

    private UUID lucas;
    private UUID cam;
    private UUID conversation;
    private final java.util.List<Client> clients = new java.util.ArrayList<>();

    /** One connected device; frames are kept in arrival order. */
    final class Client extends TextWebSocketHandler {
        final BlockingQueue<JsonNode> frames = new LinkedBlockingQueue<>();
        WebSocketSession session;

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

        void sendRaw(String text) throws Exception {
            session.sendMessage(new TextMessage(text));
        }
    }

    @BeforeEach
    void people() {
        lucas = data.user("lucas", "pt-BR");
        cam = data.user("cam", "vi-VN");
        data.password(lucas, passwords.encode("secret123"));
        data.password(cam, passwords.encode("secret123"));
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

    @Test
    void anonymousSocketsAreRejected() {
        assertThatThrownBy(() -> connect(null, ORIGIN)).hasStackTraceContaining("401");
    }

    @Test
    void foreignOriginsAreRejected() throws Exception {
        String session = sessionOf("lucas");
        assertThatThrownBy(() -> connect(session, "https://evil.example.com")).hasStackTraceContaining("403");
    }

    @Test
    void forgedSessionCookiesAreRejected() {
        assertThatThrownBy(() -> connect("bm90LWEtc2Vzc2lvbg", ORIGIN)).hasStackTraceContaining("401");
    }

    @Test
    void newMessagesArriveAndTheSenderSeesThemDelivered() throws Exception {
        conversation = steps.direct(lucas, cam);
        Client lucasDevice = connect("lucas");
        Client camDevice = connect("cam");

        JsonNode sent = steps.send(lucas, conversation, "Oi, tudo bem?");

        JsonNode created = camDevice.next("message.created").get("message");
        assertThat(created.get("id").asString()).isEqualTo(sent.get("id").asString());
        assertThat(created.at("/content/body/text").asString()).isEqualTo("Oi, tudo bem?");
        assertThat(created.at("/translation/status").asString()).isEqualTo("pending");

        assertThat(lucasDevice.next("message.created").at("/message/clientId").asString()).isEqualTo(sent.get("clientId").asString());
        JsonNode delivered = lucasDevice.next("message.delivered");
        assertThat(delivered.get("recipientId").asString()).isEqualTo(cam.toString());
        assertThat(delivered.get("upToMessageId").asString()).isEqualTo(sent.get("id").asString());
    }

    @Test
    void translationsArriveWhenTheWorkerFinishes() throws Exception {
        conversation = steps.direct(lucas, cam);
        Client camDevice = connect("cam");
        JsonNode sent = steps.send(lucas, conversation, "Bom dia");
        camDevice.next("message.created");

        worker.runOnce();

        JsonNode translating = camDevice.next("translation.updated");
        assertThat(translating.at("/translation/status").asString()).isEqualTo("translating");
        JsonNode update = camDevice.next("translation.updated", p -> p.at("/translation/status").asString().equals("translated"));
        assertThat(update.get("messageId").asString()).isEqualTo(sent.get("id").asString());
        assertThat(update.at("/translation/text").asString()).isEqualTo("[Vietnamese (Vietnam)] Bom dia");
        assertThat(update.at("/translation/version").asInt()).isOne();
    }

    @Test
    void readReceiptsReachTheSender() throws Exception {
        conversation = steps.direct(lucas, cam);
        Client lucasDevice = connect("lucas");
        JsonNode sent = steps.send(lucas, conversation, "Oi");
        api.post(cam, "/api/conversations/" + conversation + "/read", Map.of("messageId", sent.get("id").asString()))
                .andExpect(status().isNoContent());
        JsonNode read = lucasDevice.next("message.read");
        assertThat(read.get("readerId").asString()).isEqualTo(cam.toString());
    }

    @Test
    void typingIsRelayedToTheOtherMembersOnly() throws Exception {
        conversation = steps.direct(lucas, cam);
        Client lucasDevice = connect("lucas");
        Client camDevice = connect("cam");
        camDevice.sendRaw(json.writeValueAsString(Map.of("type", "typing", "conversationId", conversation, "isTyping", true)));

        JsonNode typing = lucasDevice.next("typing.started");
        assertThat(typing.get("userId").asString()).isEqualTo(cam.toString());
        assertThat(typing.get("conversationId").asString()).isEqualTo(conversation.toString());

        camDevice.sendRaw(json.writeValueAsString(Map.of("type", "typing", "conversationId", conversation, "isTyping", false)));
        lucasDevice.next("typing.stopped");
        assertThat(camDevice.frames.stream().map(f -> f.get("type").asString())).doesNotContain("typing.started");
    }

    @Test
    void outsidersCannotFakeTypingInOtherConversations() throws Exception {
        conversation = steps.direct(lucas, cam);
        UUID ana = data.user("ana", "es-ES");
        data.password(ana, passwords.encode("secret123"));
        Client lucasDevice = connect("lucas");
        Client anaDevice = connect("ana");
        anaDevice.sendRaw(json.writeValueAsString(Map.of("type", "typing", "conversationId", conversation, "isTyping", true)));
        Thread.sleep(300);
        assertThat(lucasDevice.frames.stream().map(f -> f.get("type").asString())).doesNotContain("typing.started");
    }

    @Test
    void garbageFramesAreIgnored() throws Exception {
        Client camDevice = connect("cam");
        camDevice.sendRaw("not json");
        camDevice.sendRaw("{\"type\":\"unknown\"}");
        Thread.sleep(200);
        assertThat(camDevice.session.isOpen()).isTrue();
    }

    @Test
    void contactsSeeYouComeOnlineAndLeave() throws Exception {
        conversation = steps.direct(lucas, cam);
        Client lucasDevice = connect("lucas");
        Client camDevice = connect("cam");
        assertThat(lucasDevice.next("user.online").get("userId").asString()).isEqualTo(cam.toString());

        camDevice.session.close(CloseStatus.NORMAL);
        JsonNode offline = lucasDevice.next("user.offline");
        assertThat(offline.get("userId").asString()).isEqualTo(cam.toString());
        assertThat(offline.get("lastSeenAt").asString()).isNotBlank();
    }

    @Test
    void onlineStatusShowsInProfiles() throws Exception {
        steps.direct(lucas, cam);
        connect("cam");
        await().atMost(Duration.ofSeconds(5)).until(() ->
                api.getOk(lucas, "/api/profiles/cam").get("isOnline").asBoolean());
    }

    @Test
    void notificationsArePushedLive() throws Exception {
        Client lucasDevice = connect("lucas");
        api.put(cam, "/api/profiles/" + lucas + "/follow").andExpect(status().isOk());
        JsonNode pushed = lucasDevice.next("notification.created").get("notification");
        assertThat(pushed.get("type").asString()).isEqualTo("follow");
        assertThat(pushed.at("/actor/username").asString()).isEqualTo("cam");
    }

    @Test
    void everyDeviceOfAUserReceivesEvents() throws Exception {
        conversation = steps.direct(lucas, cam);
        Client phone = connect("cam");
        Client laptop = connect("cam");
        steps.send(lucas, conversation, "Oi");
        phone.next("message.created");
        laptop.next("message.created");
    }
}
