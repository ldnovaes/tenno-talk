package com.tennotalk.ratelimit;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import com.tennotalk.support.IntegrationTest;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
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
        UUID rafael = data.user("rafael", "pt-BR");
        UUID linh = data.user("linh", "vi-VN");
        for (int i = 0; i < 30; i++) {
            api.post(rafael, "/api/posts", Map.of()).andExpect(status().isBadRequest());
        }
        api.post(rafael, "/api/posts", Map.of()).andExpect(status().isTooManyRequests());
        api.post(linh, "/api/posts", Map.of()).andExpect(status().isBadRequest());
    }

    @Test
    void readsShareOneGenerousBucket() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        for (int i = 0; i < 150; i++) {
            mvc.perform(get("/api/conversations").with(as(rafael))).andExpect(status().isOk());
        }
        // The bucket refills 20 per second while this loop runs: the 429 comes a little after the 1,200th read.
        int limitedAt = -1;
        for (int i = 150; i < 1600 && limitedAt < 0; i++) {
            int status = mvc.perform(get("/api/notifications/unread-count").with(as(rafael))).andReturn().getResponse().getStatus();
            if (status == 429) limitedAt = i;
        }
        assertThat(limitedAt).isBetween(1200, 1600);
    }

    @Test
    void searchHasItsOwnSmallerBucket() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        for (int i = 0; i < 60; i++) {
            mvc.perform(get("/api/people/search").param("q", "a").with(as(rafael))).andExpect(status().isOk());
        }
        mvc.perform(get("/api/people/search").param("q", "a").with(as(rafael))).andExpect(status().isTooManyRequests());
        mvc.perform(get("/api/conversations").with(as(rafael))).andExpect(status().isOk());
    }

    @Test
    void idleBucketsAreForgottenOnlyOnceTheyAreFullAgain() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        api.post(rafael, "/api/posts", Map.of());
        limiter.evictIdle();
        assertThat(limiter.size()).as("used a moment ago").isOne();
    }

    @Test
    void anonymousRequestsToProtectedRoutesStillGet401() throws Exception {
        for (int i = 0; i < 40; i++) {
            mvc.perform(post("/api/posts").with(csrf())).andExpect(status().isUnauthorized());
        }
    }
}
