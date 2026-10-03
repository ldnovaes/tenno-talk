package com.tennotalk.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.session.web.http.CookieSerializer.CookieValue;

import static org.assertj.core.api.Assertions.assertThat;

class SessionCookieConfigTest {

    private String written(boolean secure) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        new SessionCookieConfig().sessionCookieSerializer(secure).writeCookieValue(new CookieValue(request, response, "abc"));
        return response.getHeader("Set-Cookie");
    }

    @Test
    void productionCookieIsHttpOnlySameSiteAndSecure() {
        assertThat(written(true)).startsWith("SESSION=").contains("HttpOnly", "SameSite=Lax", "Secure", "Path=/", "Max-Age=2592000");
    }

    @Test
    void localDevelopmentCookieWorksOverHttp() {
        assertThat(written(false)).contains("HttpOnly", "SameSite=Lax").doesNotContain("Secure");
    }
}
