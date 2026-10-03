package com.tennotalk.ratelimit;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import com.tennotalk.support.IntegrationTest;

import static com.tennotalk.support.TestData.as;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@TestPropertySource(properties = "tenno.rate-limit.enabled=true")
class RateLimitIT extends IntegrationTest {

    @Autowired
    RateLimitFilter limiter;

    @BeforeEach
    void fresh() {
        limiter.reset();
    }

    @Test
    void signInAttemptsAreLimitedPerAddress() throws Exception {
        for (int i = 0; i < 10; i++) {
            mvc.perform(withJson(post("/api/auth/signin"), Map.of("email", "x@example.com", "password", "wrong-password")))
                    .andExpect(status().isUnauthorized());
        }
        mvc.perform(withJson(post("/api/auth/signin"), Map.of("email", "x@example.com", "password", "wrong-password")))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("rate_limited"));

        mvc.perform(withJson(post("/api/auth/signin"), Map.of("email", "x@example.com", "password", "wrong-password"))
                        .with(request -> {
                            request.setRemoteAddr("10.0.0.2");
                            return request;
                        }))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void limitsArePerUser() throws Exception {
        UUID lucas = data.user("lucas", "pt-BR");
        UUID cam = data.user("cam", "vi-VN");
        for (int i = 0; i < 30; i++) {
            api.post(lucas, "/api/posts", Map.of()).andExpect(status().isBadRequest());
        }
        api.post(lucas, "/api/posts", Map.of()).andExpect(status().isTooManyRequests());
        api.post(cam, "/api/posts", Map.of()).andExpect(status().isBadRequest());
    }

    @Test
    void readsAreNotLimited() throws Exception {
        UUID lucas = data.user("lucas", "pt-BR");
        for (int i = 0; i < 150; i++) {
            mvc.perform(get("/api/conversations").with(as(lucas))).andExpect(status().isOk());
        }
    }

    @Test
    void anonymousRequestsToProtectedRoutesStillGet401() throws Exception {
        for (int i = 0; i < 40; i++) {
            mvc.perform(post("/api/posts").with(csrf())).andExpect(status().isUnauthorized());
        }
    }
}
