package com.tennotalk.auth;

import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MvcResult;

import com.tennotalk.support.IntegrationTest;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Sign-in and session corners (PLAN.md §30) and replaying offline work only as its own account. */
class AuthEdgesIT extends IntegrationTest {

    @Autowired
    PasswordEncoder passwords;

    private MvcResult signIn(String email, String password) throws Exception {
        return mvc.perform(withJson(post("/api/auth/signin"), Map.of("email", email, "password", password))).andReturn();
    }

    // ---- X-Tenno-User: the outbox replays a send only under the account that queued it ----

    @ParameterizedTest(name = "{0}")
    @CsvSource({"same account, true, 200", "another account, false, 401"})
    void queuedWorkIsReplayedOnlyAsItsAccount(String name, boolean same, int expected) throws Exception {
        UUID rafael = data.user("rafael", "pt-BR"), linh = data.user("linh", "vi-VN");
        UUID conversation = steps.direct(rafael, linh);
        String header = same ? rafael.toString() : linh.toString();
        MvcResult result = mvc.perform(withJson(post("/api/conversations/" + conversation + "/messages").with(as(rafael))
                        .header("X-Tenno-User", header), Map.of("clientId", "queued", "text", "Oi")))
                .andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(expected);
        if (expected == 401) {
            assertThat(json.readTree(result.getResponse().getContentAsString()).get("code").asString()).isEqualTo("unauthenticated");
            assertThat(steps.messages(rafael, conversation).get("items").size()).as("nothing was sent").isZero();
        }
    }

    @Test
    void anAnonymousReplayIsRefusedToo() throws Exception {
        mvc.perform(get("/api/me").header("X-Tenno-User", UUID.randomUUID().toString()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void uploadsAreCheckedTheSameWay() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        var file = new org.springframework.mock.web.MockMultipartFile("file", "a.png", "image/png", new byte[] {1});
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/media").file(file)
                        .with(as(rafael)).with(csrf()).header("X-Tenno-User", UUID.randomUUID().toString()))
                .andExpect(status().isUnauthorized());
    }

    // ---- Accounts created with Google/Facebook ----

    @Test
    void anAccountWithoutPasswordCannotSignInWithOne() throws Exception {
        data.user("social", "en-US");
        assertThat(signIn("social@example.com", "anything123").getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void anAccountWithoutPasswordSetsTheFirstOneWithoutTheCurrent() throws Exception {
        UUID social = data.user("social", "en-US");
        mvc.perform(withJson(post("/api/auth/password").with(as(social)), java.util.Collections.singletonMap("next", "brand-new-pass")))
                .andExpect(status().isNoContent());
        assertThat(signIn("social@example.com", "brand-new-pass").getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void anAccountWithAPasswordMustGiveTheCurrentOne() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        data.password(rafael, passwords.encode("secret123"));
        mvc.perform(withJson(post("/api/auth/password").with(as(rafael)), java.util.Collections.singletonMap("next", "brand-new-pass")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.current").exists());
    }

    // ---- Real sessions ----

    @Test
    void anAdminSigningInForRealGetsTheAdminPages() throws Exception {
        UUID admin = data.user("admin", "en-US");
        data.password(admin, passwords.encode("secret123"));
        data.makeAdmin(admin);
        UUID user = data.user("user", "en-US");
        data.password(user, passwords.encode("secret123"));

        Cookie adminSession = sessionCookie(signIn("admin@example.com", "secret123"));
        Cookie userSession = sessionCookie(signIn("user@example.com", "secret123"));

        mvc.perform(get("/api/admin/ai").cookie(adminSession)).andExpect(status().isOk());
        mvc.perform(get("/api/admin/ai").cookie(userSession)).andExpect(status().isForbidden());
    }

    @Test
    void aSessionOfADeletedAccountIsNoLongerSignedIn() throws Exception {
        UUID gone = data.user("gone", "en-US");
        data.password(gone, passwords.encode("secret123"));
        Cookie session = sessionCookie(signIn("gone@example.com", "secret123"));
        jdbc.sql("DELETE FROM users WHERE id = :id").param("id", gone).update();

        mvc.perform(get("/api/auth/session").cookie(session)).andExpect(status().isOk()).andExpect(jsonPath("$.userId").isEmpty());
        mvc.perform(get("/api/me").cookie(session)).andExpect(status().isUnauthorized());
    }
}
