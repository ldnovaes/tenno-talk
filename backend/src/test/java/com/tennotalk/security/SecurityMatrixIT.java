package com.tennotalk.security;

import java.util.ArrayList;
import java.util.List;
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

import com.tennotalk.support.IntegrationTest;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Every API endpoint, discovered from Spring MVC, against the access rules (PLAN.md §31). */
class SecurityMatrixIT extends IntegrationTest {

    private static final Set<String> PUBLIC = Set.of("/api/auth/session", "/api/auth/signup", "/api/auth/signin");

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

    @Test
    void discoversTheWholeApi() {
        List<String> names = endpoints().stream().map(Endpoint::toString).toList();
        assertThat(names).hasSizeGreaterThanOrEqualTo(50).contains(
                "GET /api/conversations", "POST /api/conversations/{id}/messages", "POST /api/media",
                "GET /api/feed", "GET /api/stories/tray", "GET /api/notifications", "GET /api/admin/ai",
                "POST /api/translations/{kind}/{id}");
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
