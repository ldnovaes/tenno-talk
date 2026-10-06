package com.tennotalk.auth;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import com.tennotalk.support.IntegrationTest;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Google configured, Facebook not: only Google is offered and its login starts. */
@TestPropertySource(properties = {"tenno.oauth.google.client-id=test-client", "tenno.oauth.google.client-secret=test-secret"})
class OAuthConfiguredIT extends IntegrationTest {

    @Test
    void onlyConfiguredProvidersAreListed() throws Exception {
        mvc.perform(get("/api/auth/providers")).andExpect(status().isOk()).andExpect(jsonPath("$.providers", contains("google")));
    }

    @Test
    void googleLoginRedirectsToGoogleWithStateAndOurCallback() throws Exception {
        mvc.perform(get("/oauth2/authorization/google"))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", containsString("https://accounts.google.com/o/oauth2/v2/auth")))
                .andExpect(header().string("Location", containsString("client_id=test-client")))
                .andExpect(header().string("Location", containsString("state=")))
                .andExpect(header().string("Location", containsString("redirect_uri=http://localhost/login/oauth2/code/google")));
    }

    @Test
    void unconfiguredProvidersCannotStartALogin() throws Exception {
        int code = mvc.perform(get("/oauth2/authorization/facebook")).andReturn().getResponse().getStatus();
        org.assertj.core.api.Assertions.assertThat(code).isNotEqualTo(302);
    }

    @org.junit.jupiter.params.ParameterizedTest(name = "{0}")
    @org.junit.jupiter.params.provider.ValueSource(strings = {
            "/login/oauth2/code/google?error=access_denied&state=x",
            "/login/oauth2/code/google?code=abc&state=forged",
    })
    void aFailedOrForgedCallbackSendsThePersonBackToTheWelcomePage(String callback) throws Exception {
        mvc.perform(get(callback))
                .andExpect(status().is3xxRedirection())
                .andExpect(header().string("Location", "http://localhost:5173/welcome?error=oauth"));
    }
}
