package com.tennotalk.auth;

import java.util.Map;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MvcResult;

import com.tennotalk.support.IntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The real cookie-based CSRF flow. Its own application context on purpose: spring-security-test's
 * csrf() helper replaces the shared CsrfFilter repository, so any earlier test using it would hide
 * the real behaviour. Never use csrf() in this class.
 */
@TestPropertySource(properties = "tenno.test.context=csrf-browser-flow")
class CsrfBrowserFlowIT extends IntegrationTest {

    /** What the SPA really does: read XSRF-TOKEN from the first response and echo it in X-XSRF-TOKEN. */
    @Test
    void theBrowserCsrfRoundTripWorksWithoutTestShortcuts() throws Exception {
        MvcResult first = mvc.perform(get("/api/auth/session")).andExpect(status().isOk()).andReturn();
        Cookie xsrf = first.getResponse().getCookie("XSRF-TOKEN");
        assertThat(xsrf).isNotNull();
        assertThat(xsrf.isHttpOnly()).isFalse();
        String body = json.writeValueAsString(Map.of("email", "csrf@example.com", "password", "secret123"));

        mvc.perform(post("/api/auth/signup").contentType("application/json").content(body).cookie(xsrf))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/signup").contentType("application/json").content(body).cookie(xsrf)
                        .header("X-XSRF-TOKEN", "forged"))
                .andExpect(status().isForbidden());
        MvcResult created = mvc.perform(post("/api/auth/signup").contentType("application/json").content(body).cookie(xsrf)
                        .header("X-XSRF-TOKEN", xsrf.getValue()))
                .andExpect(status().isCreated()).andReturn();

        Cookie session = sessionCookie(created);
        assertThat(session.isHttpOnly()).isTrue();
        assertThat(created.getResponse().getHeaders("Set-Cookie"))
                .anySatisfy(header -> assertThat(header).startsWith("SESSION=").contains("HttpOnly").contains("SameSite=Lax"));
        // A new session gets a fresh token; the signed-in app keeps working with it.
        Cookie rotated = created.getResponse().getCookie("XSRF-TOKEN");
        Cookie token = rotated != null && !rotated.getValue().isEmpty() ? rotated : xsrf;
        mvc.perform(post("/api/auth/signout").cookie(session, token).header("X-XSRF-TOKEN", token.getValue()))
                .andExpect(status().isNoContent());
    }
}
