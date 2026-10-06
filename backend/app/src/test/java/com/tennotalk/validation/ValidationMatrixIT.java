package com.tennotalk.validation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.as;
import static com.tennotalk.support.TestData.asAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

/**
 * Every input rule of the API that had no test of its own (PLAN.md §31: Bean Validation on every DTO, Problem
 * Details on every error). One row per rule: the request, then the status, the code and, for field rules, which
 * field the SPA highlights. A 500 here is always a bug: bad input is the client's problem, never the server's.
 */
class ValidationMatrixIT extends IntegrationTest {

    enum Who { ME, ADMIN, NEWCOMER, ANONYMOUS }

    record Row(String name, Who who, HttpMethod method, String path, String contentType, String body,
               int status, String code, String field) {
        @Override
        public String toString() {
            return name;
        }
    }

    private static final String JSON = MediaType.APPLICATION_JSON_VALUE;

    private static Row row(String name, HttpMethod method, String path, String body, int status, String code, String field) {
        return new Row(name, Who.ME, method, path, JSON, body, status, code, field);
    }

    private static Row by(Who who, Row row) {
        return new Row(row.name, who, row.method, row.path, row.contentType, row.body, row.status, row.code, row.field);
    }

    private static String text(int length) {
        return "a".repeat(length);
    }

    private static String ids(int count) {
        return "[" + String.join(",", Collections.nCopies(count, "\"" + UUID.randomUUID() + "\"")) + "]";
    }

    private static String onboarding(String field, String value) {
        Map<String, String> body = new java.util.LinkedHashMap<>(Map.of(
                "nativeLanguage", "\"pt-BR\"", "receivingLanguage", "\"pt-BR\"", "displayName", "\"Nova\"",
                "username", "\"nova_pessoa\"", "bio", "\"\"", "country", "\"BR\""));
        body.put(field, value);
        return "{" + String.join(",", body.entrySet().stream().map(e -> "\"" + e.getKey() + "\":" + e.getValue()).toList()) + "}";
    }

    private static String profile(String field, String value) {
        Map<String, String> body = new java.util.LinkedHashMap<>(Map.of(
                "displayName", "\"Me\"", "username", "\"me_user\"", "bio", "\"\"", "country", "\"BR\"",
                "nativeLanguage", "\"pt-BR\"", "learningLanguages", "[]"));
        body.put(field, value);
        return "{" + String.join(",", body.entrySet().stream().map(e -> "\"" + e.getKey() + "\":" + e.getValue()).toList()) + "}";
    }

    static Stream<Row> rows() {
        List<Row> rows = new ArrayList<>();
        HttpMethod GET = HttpMethod.GET, POST = HttpMethod.POST, PUT = HttpMethod.PUT, PATCH = HttpMethod.PATCH;

        // Auth
        rows.add(by(Who.ANONYMOUS, row("signup: password over 200", POST, "/api/auth/signup",
                "{\"email\":\"n@example.com\",\"password\":\"" + text(201) + "\"}", 400, "validation", "password")));
        rows.add(by(Who.ANONYMOUS, row("signin: malformed JSON", POST, "/api/auth/signin", "{\"email\":", 400, "validation", null)));
        rows.add(by(Who.ANONYMOUS, row("signin: no body", POST, "/api/auth/signin", null, 400, "validation", null)));
        rows.add(row("password: new one under 8", POST, "/api/auth/password", "{\"current\":\"x\",\"next\":\"short\"}", 400, "validation", "next"));

        // Onboarding (a user who has not finished it)
        rows.add(by(Who.NEWCOMER, row("onboarding: country with 3 letters", POST, "/api/me/onboarding", onboarding("country", "\"BRA\""), 400, "validation", "country")));
        rows.add(by(Who.NEWCOMER, row("onboarding: display name over 40", POST, "/api/me/onboarding", onboarding("displayName", "\"" + text(41) + "\""), 400, "validation", "displayName")));
        rows.add(by(Who.NEWCOMER, row("onboarding: bio over 160", POST, "/api/me/onboarding", onboarding("bio", "\"" + text(161) + "\""), 400, "validation", "bio")));
        rows.add(by(Who.NEWCOMER, row("onboarding: unsupported native language", POST, "/api/me/onboarding", onboarding("nativeLanguage", "\"xx-XX\""), 400, "validation", null)));
        rows.add(by(Who.NEWCOMER, row("onboarding: unsupported receiving language", POST, "/api/me/onboarding", onboarding("receivingLanguage", "\"xx-XX\""), 400, "validation", null)));

        // Profile
        rows.add(row("profile: 6 learning languages", PUT, "/api/me/profile",
                profile("learningLanguages", "[\"en-US\",\"es-ES\",\"fr-FR\",\"de-DE\",\"it-IT\",\"ja-JP\"]"), 400, "validation", "learningLanguages"));
        rows.add(row("profile: username taken by someone else", PUT, "/api/me/profile", profile("username", "\"linh\""), 409, "conflict", "username"));
        rows.add(row("profile: no learning languages list", PUT, "/api/me/profile", profile("learningLanguages", "null"), 400, "validation", "learningLanguages"));

        // Preferences: every enumerated value rejects anything else
        for (String field : List.of("profileVisibility", "whoCanMessage", "whoCanComment", "whoCanSeeOnline")) {
            rows.add(row("preferences: privacy." + field + " unknown", PATCH, "/api/me/preferences",
                    "{\"privacy\":{\"" + field + "\":\"friends\"}}", 400, "validation", null));
        }
        rows.add(row("preferences: unsupported interface language", PATCH, "/api/me/preferences", "{\"interfaceLanguage\":\"xx-XX\"}", 400, "validation", null));
        rows.add(row("preferences: empty patch keeps everything", PATCH, "/api/me/preferences", "{}", 200, null, null));
        rows.add(row("preferences: no body", PATCH, "/api/me/preferences", null, 400, "validation", null));
        rows.add(row("preferences: wrong type", PATCH, "/api/me/preferences", "{\"notifications\":{\"likes\":\"maybe\"}}", 400, "validation", null));

        // People
        rows.add(row("search: limit is not a number", GET, "/api/people/search?q=li&limit=abc", null, 400, "validation", null));
        rows.add(row("search: no query lists people (like suggestions)", GET, "/api/people/search", null, 200, null, null));

        // Chat
        rows.add(row("send: 11 attachments", POST, "/api/conversations/{conv}/messages",
                "{\"clientId\":\"k1\",\"text\":\"x\",\"mediaIds\":" + ids(11) + "}", 400, "validation", "mediaIds"));
        rows.add(row("send: clientId over 100", POST, "/api/conversations/{conv}/messages",
                "{\"clientId\":\"" + text(101) + "\",\"text\":\"x\"}", 400, "validation", "clientId"));
        rows.add(row("send: no clientId", POST, "/api/conversations/{conv}/messages", "{\"text\":\"x\"}", 400, "validation", "clientId"));
        rows.add(row("send: reply id is not a UUID", POST, "/api/conversations/{conv}/messages",
                "{\"clientId\":\"k2\",\"text\":\"x\",\"replyToId\":\"nope\"}", 400, "validation", null));
        rows.add(row("delivered: empty list", POST, "/api/conversations/{conv}/delivered", "{\"messageIds\":[]}", 400, "validation", "messageIds"));
        rows.add(row("delivered: 101 ids", POST, "/api/conversations/{conv}/delivered", "{\"messageIds\":" + ids(101) + "}", 400, "validation", "messageIds"));
        rows.add(row("read: no message id", POST, "/api/conversations/{conv}/read", "{}", 400, "validation", "messageId"));
        rows.add(row("mute: not a boolean", PUT, "/api/conversations/{conv}/mute", "{\"muted\":\"soon\"}", 400, "validation", null));
        rows.add(row("react: blank emoji", POST, "/api/messages/{msg}/reactions", "{\"emoji\":\" \"}", 400, "validation", "emoji"));
        rows.add(row("react: emoji over 16", POST, "/api/messages/{msg}/reactions", "{\"emoji\":\"" + text(17) + "\"}", 400, "validation", "emoji"));
        rows.add(row("react: unknown message", POST, "/api/messages/{random}/reactions", "{\"emoji\":\"👍\"}", 404, "not_found", null));
        rows.add(row("forward: no target", POST, "/api/messages/{msg}/forward", "{\"conversationIds\":[]}", 400, "validation", "conversationIds"));
        rows.add(row("forward: 21 targets", POST, "/api/messages/{msg}/forward", "{\"conversationIds\":" + ids(21) + "}", 400, "validation", "conversationIds"));
        rows.add(row("forward: unknown message", POST, "/api/messages/{random}/forward", "{\"conversationIds\":[\"{conv}\"]}", 404, "not_found", null));
        rows.add(row("direct: no user", POST, "/api/conversations/direct", "{}", 400, "validation", "userId"));
        rows.add(row("direct: user id is not a UUID", POST, "/api/conversations/direct", "{\"userId\":\"linh\"}", 400, "validation", null));
        rows.add(row("group: title over 60", POST, "/api/conversations/groups",
                "{\"title\":\"" + text(61) + "\",\"memberIds\":" + ids(2) + "}", 400, "validation", "title"));
        rows.add(row("group: 51 members", POST, "/api/conversations/groups", "{\"title\":\"G\",\"memberIds\":" + ids(51) + "}", 400, "validation", "memberIds"));
        rows.add(row("group: the same person twice is one member", POST, "/api/conversations/groups",
                "{\"title\":\"G\",\"memberIds\":[\"{other}\",\"{other}\"]}", 400, "validation", null));
        rows.add(row("insight: no language", GET, "/api/messages/{msg}/insight", null, 400, "validation", null));
        rows.add(row("retry translation: unknown message", POST, "/api/messages/{random}/translation/retry", null, 404, "not_found", null));

        // Feed
        rows.add(row("comment: clientId over 100", POST, "/api/posts/{post}/comments",
                "{\"text\":\"Oi\",\"clientId\":\"" + text(101) + "\"}", 400, "validation", "clientId"));
        // A malformed id is an unknown one, as in paths (ChatIT: malformed conversation id → 404).
        rows.add(row("comments: afterId is not an id", GET, "/api/posts/{post}/comments?afterId=nope", null, 404, "not_found", null));
        rows.add(row("unlike: unknown post", HttpMethod.DELETE, "/api/posts/{random}/like", null, 404, "not_found", null));
        rows.add(row("translate content: unsupported language", POST, "/api/translations/post/{post}?lang=xx-XX", null, 400, "validation", null));

        // Stories
        rows.add(row("story reaction: emoji over 16", POST, "/api/stories/{story}/reactions", "{\"emoji\":\"" + text(17) + "\"}", 400, "validation", "emoji"));
        rows.add(row("story reply: clientId over 100", POST, "/api/stories/{story}/replies",
                "{\"clientId\":\"" + text(101) + "\",\"text\":\"Oi\"}", 400, "validation", "clientId"));
        rows.add(row("story reply: text over 4000", POST, "/api/stories/{story}/replies", "{\"text\":\"" + text(4001) + "\"}", 400, "validation", "text"));

        // Notifications
        rows.add(row("notifications read: 101 ids", POST, "/api/notifications/read", "{\"ids\":" + ids(101) + "}", 400, "validation", "ids"));
        rows.add(row("notifications read: no list", POST, "/api/notifications/read", "{}", 400, "validation", "ids"));
        rows.add(row("notifications read: a null id", POST, "/api/notifications/read", "{\"ids\":[null]}", 400, "validation", null));
        rows.add(row("notifications: beforeId is not a UUID", GET, "/api/notifications?beforeId=nope", null, 400, "validation", null));

        // Reports
        rows.add(row("report: no target id", POST, "/api/reports", "{\"targetKind\":\"user\",\"reason\":\"spam\"}", 400, "validation", "targetId"));
        rows.add(row("report: blank kind", POST, "/api/reports", "{\"targetKind\":\"\",\"targetId\":\"{other}\",\"reason\":\"spam\"}", 400, "validation", "targetKind"));
        rows.add(by(Who.ADMIN, row("resolve report: blank status", PATCH, "/api/admin/reports/{random}", "{\"status\":\"\"}", 400, "validation", "status")));

        // Discover
        rows.add(row("discover events: 101 events", POST, "/api/discover/events",
                "{\"events\":[" + String.join(",", Collections.nCopies(101, "{}")) + "]}", 400, "validation", null));
        rows.add(row("discover events: no list", POST, "/api/discover/events", "{}", 400, "validation", "events"));

        // Push
        rows.add(row("push subscribe: blank endpoint", POST, "/api/push/subscriptions",
                "{\"endpoint\":\"\",\"keys\":{\"p256dh\":\"k\",\"auth\":\"a\"}}", 400, "validation", "endpoint"));
        rows.add(row("push subscribe: no keys", POST, "/api/push/subscriptions", "{\"endpoint\":\"https://fcm.googleapis.com/x\"}", 400, "validation", "keys"));
        rows.add(row("push unsubscribe: endpoint over 4096", HttpMethod.DELETE, "/api/push/subscriptions",
                "{\"endpoint\":\"" + text(4097) + "\"}", 400, "validation", "endpoint"));

        // Protocol errors: wrong method, wrong body type, unknown route
        rows.add(row("method not allowed", PATCH, "/api/conversations", "{}", 405, "validation", null));
        rows.add(new Row("body that is not JSON", Who.ME, POST, "/api/conversations/direct", MediaType.TEXT_PLAIN_VALUE,
                "linh", 415, "validation", null));
        rows.add(row("upload as JSON instead of multipart", POST, "/api/media", "{}", 415, "validation", null));
        rows.add(row("unknown API route", GET, "/api/nope", null, 404, "not_found", null));
        return rows.stream();
    }

    private UUID me;
    private UUID other;
    private UUID admin;
    private UUID newcomer;
    private Map<String, String> ids;

    @BeforeEach
    void world() throws Exception {
        me = data.user("me_user", "pt-BR");
        other = data.user("linh", "vi-VN");
        admin = data.user("admin_user", "en-US");
        data.makeAdmin(admin);
        newcomer = data.newcomer("newcomer");
        data.follow(me, other);
        data.follow(other, me);
        UUID conversation = steps.direct(me, other);
        String message = steps.send(other, conversation, "Chào").get("id").asString();
        String post = api.postOk(other, "/api/posts", Map.of("mediaIds", List.of(data.media(other, "image")), "caption", "Hà Nội")).get("id").asString();
        String story = api.postOk(other, "/api/stories", Map.of("mediaId", data.media(other, "image"))).get("id").asString();
        ids = Map.of("{conv}", conversation.toString(), "{msg}", message, "{post}", post, "{story}", story,
                "{other}", other.toString(), "{random}", UUID.randomUUID().toString());
    }

    private String fill(String template) {
        String result = template;
        for (var entry : ids.entrySet()) result = result.replace(entry.getKey(), entry.getValue());
        return result;
    }

    @org.junit.jupiter.api.Test
    void uploadWithoutTheFilePart() throws Exception {
        MvcResult result = mvc.perform(MockMvcRequestBuilders.multipart("/api/media").param("name", "x").with(as(me)).with(csrf()))
                .andReturn();
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(400);
        assertThat(json.readTree(result.getResponse().getContentAsString()).path("code").asString()).isEqualTo("validation");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("rows")
    void rejectsBadInputAsTheClientsProblem(Row row) throws Exception {
        MockHttpServletRequestBuilder request = MockMvcRequestBuilders.request(row.method, fill(row.path)).with(csrf());
        switch (row.who) {
            case ME -> request.with(as(me));
            case ADMIN -> request.with(asAdmin(admin));
            case NEWCOMER -> request.with(as(newcomer));
            case ANONYMOUS -> { }
        }
        if (row.body != null) request.contentType(row.contentType).content(fill(row.body));
        MvcResult result = mvc.perform(request).andReturn();
        String body = result.getResponse().getContentAsString();

        assertThat(result.getResponse().getStatus()).as(body).isEqualTo(row.status);
        if (row.code == null) return;
        JsonNode problem = json.readTree(body);
        assertThat(problem.path("code").asString()).as(body).isEqualTo(row.code);
        assertThat(problem.path("detail").asString()).as("a message the SPA can show").isNotBlank();
        if (row.field != null) assertThat(problem.path("fieldErrors").has(row.field)).as(body).isTrue();
    }
}
