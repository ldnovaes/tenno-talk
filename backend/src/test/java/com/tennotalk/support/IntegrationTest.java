package com.tennotalk.support;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import tools.jackson.databind.json.JsonMapper;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

/** Full application against a real PostgreSQL (Testcontainers). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import({TestcontainersConfig.class, FakeAiConfig.class})
public abstract class IntegrationTest {

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JdbcClient jdbc;

    @Autowired
    protected TestData data;

    @Autowired
    protected JsonMapper json;

    @Autowired
    protected FakeProcessRunner ai;

    @Autowired
    private com.tennotalk.translation.ReauthService reauth;

    protected ChatSteps steps;

    protected Api api;

    @BeforeEach
    void resetState() {
        steps = new ChatSteps(mvc, json);
        api = new Api(mvc, json);
        data.reset();
        ai.reset();
        reauth.clearThrottle();
    }

    /** The Spring Session cookie set by a response (the browser's credential). */
    protected static jakarta.servlet.http.Cookie sessionCookie(org.springframework.test.web.servlet.MvcResult result) {
        jakarta.servlet.http.Cookie cookie = result.getResponse().getCookie("SESSION");
        if (cookie == null) throw new AssertionError("No SESSION cookie in the response");
        return cookie;
    }

    /** JSON body + CSRF token, the way the SPA sends mutating requests. */
    protected MockHttpServletRequestBuilder withJson(MockHttpServletRequestBuilder request, Object body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)).with(csrf());
    }
}
