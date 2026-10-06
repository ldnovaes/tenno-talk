package com.tennotalk.auth;

import java.util.Map;

import org.junit.jupiter.api.Test;
import jakarta.servlet.http.Cookie;

import org.springframework.test.web.servlet.MvcResult;

import com.tennotalk.support.IntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthIT extends IntegrationTest {

    private Cookie signUp(String email, String password) throws Exception {
        MvcResult result = mvc.perform(withJson(post("/api/auth/signup"), Map.of("email", email, "password", password))
                        .header("Accept-Language", "vi-VN,vi;q=0.9,en;q=0.8"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.userId").isNotEmpty())
                .andReturn();
        return sessionCookie(result);
    }

    @Test
    void anonymousSessionHasNoUser() throws Exception {
        mvc.perform(get("/api/auth/session")).andExpect(status().isOk()).andExpect(jsonPath("$.userId").isEmpty());
    }

    @Test
    void signUpStartsASessionAndDetectsTheDeviceLanguage() throws Exception {
        Cookie session = signUp("New@Example.com", "secret123");
        mvc.perform(get("/api/auth/session").cookie(session)).andExpect(jsonPath("$.userId").isNotEmpty());
        mvc.perform(get("/api/me").cookie(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("new@example.com"))
                .andExpect(jsonPath("$.nativeLanguage").value("vi-VN"))
                .andExpect(jsonPath("$.preferences.translation.receivingLanguage").value("vi-VN"))
                .andExpect(jsonPath("$.onboardingCompletedAt").isEmpty())
                .andExpect(jsonPath("$.termsAcceptedVersion").isEmpty())
                .andExpect(jsonPath("$.connectedProviders[0]").value("password"));
    }

    @Test
    void passwordsAreHashedWithArgon2() throws Exception {
        signUp("hash@example.com", "secret123");
        String hash = jdbc.sql("SELECT password_hash FROM users WHERE email = 'hash@example.com'").query(String.class).single();
        assertThat(hash).startsWith("$argon2id$").doesNotContain("secret123");
    }

    @Test
    void duplicateEmailIsAConflictWithAFieldError() throws Exception {
        signUp("dup@example.com", "secret123");
        mvc.perform(withJson(post("/api/auth/signup"), Map.of("email", "DUP@example.com", "password", "secret123")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("conflict"))
                .andExpect(jsonPath("$.fieldErrors.email").isNotEmpty());
    }

    @Test
    void signUpValidatesInput() throws Exception {
        mvc.perform(withJson(post("/api/auth/signup"), Map.of("email", "not-an-email", "password", "short")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("validation"))
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.password").exists());
    }

    @Test
    void signInChecksThePassword() throws Exception {
        signUp("login@example.com", "secret123");
        mvc.perform(withJson(post("/api/auth/signin"), Map.of("email", "login@example.com", "password", "wrong-one")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthenticated"))
                .andExpect(jsonPath("$.detail").value("Invalid email or password."));
        mvc.perform(withJson(post("/api/auth/signin"), Map.of("email", "nobody@example.com", "password", "whatever1")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail").value("Invalid email or password."));
        MvcResult ok = mvc.perform(withJson(post("/api/auth/signin"), Map.of("email", "LOGIN@example.com", "password", "secret123")))
                .andExpect(status().isOk())
                .andReturn();
        Cookie session = sessionCookie(ok);
        mvc.perform(get("/api/me").cookie(session)).andExpect(status().isOk());
    }

    @Test
    void signOutEndsTheSession() throws Exception {
        Cookie session = signUp("out@example.com", "secret123");
        mvc.perform(post("/api/auth/signout").cookie(session).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    @Test
    void mutatingRequestsRequireTheCsrfToken() throws Exception {
        mvc.perform(post("/api/auth/signin").contentType("application/json")
                        .content("{\"email\":\"a@b.com\",\"password\":\"x\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void theApiAnswersProblemDetailsWhenAnonymous() throws Exception {
        mvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("unauthenticated"))
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void changePasswordChecksTheCurrentOne() throws Exception {
        Cookie session = signUp("pw@example.com", "secret123");
        mvc.perform(withJson(post("/api/auth/password"), Map.of("current", "wrong", "next", "newsecret1")).cookie(session))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.current").exists());
        mvc.perform(withJson(post("/api/auth/password"), Map.of("current", "secret123", "next", "newsecret1")).cookie(session))
                .andExpect(status().isNoContent());
        mvc.perform(withJson(post("/api/auth/signin"), Map.of("email", "pw@example.com", "password", "newsecret1")))
                .andExpect(status().isOk());
    }

    @Test
    void deletingTheAccountEndsEverySessionOfIt() throws Exception {
        Cookie first = signUp("gone@example.com", "secret123");
        mvc.perform(withJson(post("/api/auth/signin"), Map.of("email", "gone@example.com", "password", "secret123"))).andExpect(status().isOk());
        String userId = jdbc.sql("SELECT id::text FROM users WHERE email = 'gone@example.com'").query(String.class).single();
        assertThat(jdbc.sql("SELECT count(*) FROM spring_session WHERE principal_name = :u").param("u", userId).query(Long.class).single()).isEqualTo(2);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/me").cookie(first).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(jdbc.sql("SELECT count(*) FROM spring_session WHERE principal_name = :u").param("u", userId).query(Long.class).single()).isZero();
    }

    @Test
    void healthIsPublic() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }
}
