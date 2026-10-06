package com.tennotalk.security;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpMethod;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import com.tennotalk.ratelimit.RateLimitRules;
import com.tennotalk.support.IntegrationTest;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Every API endpoint, discovered from Spring MVC, against the access rules (PLAN.md §31). */
class SecurityMatrixIT extends IntegrationTest {

    private static final Set<String> PUBLIC = Set.of("/api/auth/session", "/api/auth/signup", "/api/auth/signin", "/api/auth/providers");

    record Endpoint(HttpMethod method, String pattern) {
        String path() {
            return pattern.replaceAll("\\{[^}]+}", UUID.randomUUID().toString());
        }

        boolean mutating() {
            return method != HttpMethod.GET && method != HttpMethod.HEAD;
        }

        MockHttpServletRequestBuilder request() {
            return MockMvcRequestBuilders.request(method, path());
        }

        @Override
        public String toString() {
            return method + " " + pattern;
        }
    }

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping mappings;

    private List<Endpoint> endpoints() {
        List<Endpoint> result = new ArrayList<>();
        mappings.getHandlerMethods().keySet().forEach(info -> {
            if (info.getPathPatternsCondition() == null) return;
            for (String pattern : info.getPathPatternsCondition().getPatternValues()) {
                if (!pattern.startsWith("/api/") || pattern.startsWith("/api/openapi")) continue;
                Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
                for (RequestMethod method : methods) result.add(new Endpoint(method.asHttpMethod(), pattern));
            }
        });
        return result;
    }

    /**
     * Rate limit of every endpoint (PLAN.md §31, §38). Reads not listed here share the generous "read" bucket;
     * the exceptions cost AI (insight), a database dump (export) or a search. A new endpoint fails here until it
     * is classified.
     */
    private static final Map<String, String> RATE_LIMITS = Map.ofEntries(
            Map.entry("POST /api/auth/signin", "auth"),
            Map.entry("POST /api/auth/signup", "auth"),
            Map.entry("POST /api/auth/password", "auth"),
            Map.entry("POST /api/conversations/{id}/messages", "send"),
            Map.entry("POST /api/stories/{id}/replies", "send"),
            Map.entry("POST /api/messages/{id}/forward", "forward"),
            Map.entry("POST /api/media", "upload"),
            Map.entry("POST /api/messages/{id}/translation/retry", "translate"),
            Map.entry("GET /api/messages/{id}/insight", "translate"),
            Map.entry("POST /api/translations/{kind}/{id}", "translate"),
            Map.entry("POST /api/discover/events", "discover"),
            Map.entry("DELETE /api/discover/hidden/posts/{postId}", "discover"),
            Map.entry("DELETE /api/discover/hidden/authors/{authorId}", "discover"),
            Map.entry("PUT /api/profiles/{userId}/follow", "social"),
            Map.entry("DELETE /api/profiles/{userId}/follow", "social"),
            Map.entry("PUT /api/profiles/{userId}/block", "social"),
            Map.entry("DELETE /api/profiles/{userId}/block", "social"),
            Map.entry("PUT /api/posts/{id}/like", "social"),
            Map.entry("DELETE /api/posts/{id}/like", "social"),
            Map.entry("POST /api/posts/{id}/comments", "social"),
            Map.entry("POST /api/stories/{id}/reactions", "send"),
            Map.entry("POST /api/messages/{id}/reactions", "social"),
            Map.entry("POST /api/posts", "create"),
            Map.entry("POST /api/stories", "create"),
            Map.entry("POST /api/conversations/direct", "create"),
            Map.entry("POST /api/conversations/groups", "create"),
            Map.entry("POST /api/reports", "report"),
            Map.entry("GET /api/me/export", "export"),
            Map.entry("POST /api/admin/ai/{provider}/check", "admin"),
            Map.entry("PATCH /api/me/preferences", "settings"),
            Map.entry("PUT /api/me/profile", "settings"),
            Map.entry("POST /api/push/subscriptions", "settings"),
            Map.entry("DELETE /api/push/subscriptions", "settings"),
            Map.entry("POST /api/conversations/{id}/delivered", "receipts"),
            Map.entry("POST /api/conversations/{id}/read", "receipts"),
            Map.entry("GET /api/people/search", "search"),
            Map.entry("GET /api/people/suggestions", "search"));

    /** Writes with no limit: bounded by what the person owns, or needed to keep the app in sync. */
    private static final Set<String> UNLIMITED_WRITES = Set.of(
            "POST /api/auth/signout", "DELETE /api/me", "POST /api/me/onboarding", "POST /api/me/terms",
            "DELETE /api/me/follow-requests/{userId}", "POST /api/me/follow-requests/{userId}/approve",
            "PUT /api/conversations/{id}/mute", "POST /api/notifications/read", "POST /api/notifications/read-all",
            "PUT /api/stories/{id}/view", "PATCH /api/admin/reports/{id}");

    @TestFactory
    Stream<DynamicTest> everyEndpointHasItsRateLimit() {
        return endpoints().stream().map(endpoint -> DynamicTest.dynamicTest(endpoint.toString(), () -> {
            String key = endpoint.toString();
            if (endpoint.mutating() && !RATE_LIMITS.containsKey(key))
                assertThat(UNLIMITED_WRITES).as("unclassified write: add it to RATE_LIMITS or UNLIMITED_WRITES").contains(key);
            String expected = RATE_LIMITS.getOrDefault(key, endpoint.mutating() ? "none" : "read");
            String actual = RateLimitRules.match(endpoint.method().name(), endpoint.path()).map(RateLimitRules.Rule::name).orElse("none");
            assertThat(actual).isEqualTo(expected);
        }));
    }

    @Test
    void discoversTheWholeApi() {
        List<String> names = endpoints().stream().map(Endpoint::toString).toList();
        assertThat(names).hasSizeGreaterThanOrEqualTo(50).contains(
                "GET /api/conversations", "POST /api/conversations/{id}/messages", "POST /api/media",
                "GET /api/feed", "GET /api/stories/tray", "GET /api/notifications", "GET /api/admin/ai",
                "POST /api/translations/{kind}/{id}", "GET /api/discover", "POST /api/discover/events");
    }

    @TestFactory
    Stream<DynamicTest> anonymousRequestsAreRejected() {
        return endpoints().stream().filter(e -> !PUBLIC.contains(e.pattern())).map(endpoint ->
                DynamicTest.dynamicTest(endpoint.toString(), () -> mvc.perform(endpoint.request().with(csrf()))
                        .andExpect(status().isUnauthorized())
                        .andExpect(jsonPath("$.code").value("unauthenticated"))));
    }

    @TestFactory
    Stream<DynamicTest> mutatingRequestsNeedACsrfToken() {
        UUID user = data.user("csrf", "en-US");
        return endpoints().stream().filter(Endpoint::mutating).map(endpoint ->
                DynamicTest.dynamicTest(endpoint.toString(), () -> mvc.perform(endpoint.request().with(as(user)))
                        .andExpect(status().isForbidden())));
    }

    @TestFactory
    Stream<DynamicTest> adminRoutesNeedTheAdminRole() {
        UUID user = data.user("regular", "en-US");
        return endpoints().stream().filter(e -> e.pattern().startsWith("/api/admin/")).map(endpoint ->
                DynamicTest.dynamicTest(endpoint.toString(), () -> mvc.perform(endpoint.request().with(as(user)).with(csrf()))
                        .andExpect(status().isForbidden())
                        .andExpect(jsonPath("$.code").value("forbidden"))));
    }

    @Test
    void healthIsPublicButRevealsNoDetails() throws Exception {
        String body = mvc.perform(MockMvcRequestBuilders.get("/actuator/health")).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(body).contains("UP").doesNotContain("postgres").doesNotContain("diskSpace");
    }

    @Test
    void otherActuatorEndpointsAreNotExposed() throws Exception {
        UUID user = data.user("someone", "en-US");
        for (String path : List.of("/actuator/env", "/actuator/beans", "/actuator/heapdump", "/actuator/configprops")) {
            int code = mvc.perform(MockMvcRequestBuilders.get(path).with(as(user))).andReturn().getResponse().getStatus();
            assertThat(code).as(path).isIn(401, 403, 404);
        }
    }
}
