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
            "POST, /api/stories/abc/reactions, send",
            "POST, /api/posts, create",
            "POST, /api/stories, create",
            "POST, /api/conversations/direct, create",
            "POST, /api/conversations/groups, create",
            "POST, /api/admin/ai/openai/check, admin",
            "POST, /api/messages/abc/forward, forward",
            "PATCH, /api/me/preferences, settings",
            "PUT, /api/me/profile, settings",
            "POST, /api/push/subscriptions, settings",
            "DELETE, /api/push/subscriptions, settings",
            "POST, /api/conversations/abc/delivered, receipts",
            "POST, /api/conversations/abc/read, receipts",
            "GET, /api/people/search, search",
            "GET, /api/people/suggestions, search",
            "GET, /api/conversations, read",
            "GET, /api/conversations/abc/messages, read",
            "GET, /api/feed, read",
            "GET, /api/auth/session, read",
            "GET, /api/media/abc, read",
            "GET, /api/admin/ai, read",
            "GET, /api/posts/abc/comments, read",
            "GET, /api/discover, read",
            "POST, /api/messages/abc/reactions, social",
            "POST, /api/discover/events, discover",
            "DELETE, /api/discover/hidden/posts/abc, discover",
            "POST, /api/reports, report",
            "GET, /api/me/export, export",
    })
    void limitedRequests(String method, String path, String rule) {
        assertThat(RateLimitRules.match(method, path)).hasValueSatisfying(r -> assertThat(r.name()).isEqualTo(rule));
    }

    @ParameterizedTest
    @CsvSource({
            "POST, /api/auth/signout",
            "PUT, /api/conversations/abc/mute",
            "POST, /api/notifications/read-all",
            "GET, /assets/index.js",
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

    @org.junit.jupiter.api.Test
    void onDemandTranslationAlsoHasADailyCeiling() {
        var translate = RateLimitRules.match("POST", "/api/translations/post/abc").orElseThrow();
        assertThat(translate.limits()).containsExactly(
                new RateLimitRules.Limit(60, java.time.Duration.ofMinutes(1)), new RateLimitRules.Limit(500, java.time.Duration.ofDays(1)));
        assertThat(translate.refillTime()).isEqualTo(java.time.Duration.ofDays(1));
    }
}
