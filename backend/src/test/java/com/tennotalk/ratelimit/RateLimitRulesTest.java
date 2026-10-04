package com.tennotalk.ratelimit;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimitRulesTest {

    @ParameterizedTest
    @CsvSource({
            "POST, /api/auth/signin, auth",
            "POST, /api/auth/signup, auth",
            "POST, /api/auth/password, auth",
            "POST, /api/conversations/abc/messages, send",
            "POST, /api/stories/abc/replies, send",
            "POST, /api/media, upload",
            "POST, /api/messages/abc/translation/retry, translate",
            "GET,  /api/messages/abc/insight, translate",
            "POST, /api/translations/post/abc, translate",
            "PUT,  /api/profiles/abc/follow, social",
            "DELETE, /api/profiles/abc/block, social",
            "PUT,  /api/posts/abc/like, social",
            "POST, /api/posts/abc/comments, social",
            "POST, /api/stories/abc/reactions, social",
            "POST, /api/posts, create",
            "POST, /api/stories, create",
            "POST, /api/conversations/direct, create",
            "POST, /api/conversations/groups, create",
            "POST, /api/admin/ai/openai/check, admin",
    })
    void limitedRequests(String method, String path, String rule) {
        assertThat(RateLimitRules.match(method, path)).hasValueSatisfying(r -> assertThat(r.name()).isEqualTo(rule));
    }

    @ParameterizedTest
    @CsvSource({
            "GET, /api/conversations",
            "GET, /api/conversations/abc/messages",
            "GET, /api/feed",
            "GET, /api/auth/session",
            "POST, /api/auth/signout",
            "GET, /api/media/abc",
            "GET, /api/admin/ai",
            "POST, /api/conversations/abc/read",
    })
    void unlimitedRequests(String method, String path) {
        assertThat(RateLimitRules.match(method, path)).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({"/api/auth/signin/extra", "/api/mediax", "/api/posts/abc"})
    void rulesMatchWholePaths(String path) {
        assertThat(RateLimitRules.match("POST", path).map(RateLimitRules.Rule::name)).isNotEqualTo(java.util.Optional.of("upload"));
        assertThat(RateLimitRules.match("POST", path).map(RateLimitRules.Rule::name)).isNotEqualTo(java.util.Optional.of("auth"));
        assertThat(RateLimitRules.match("POST", path).map(RateLimitRules.Rule::name)).isNotEqualTo(java.util.Optional.of("create"));
    }
}
