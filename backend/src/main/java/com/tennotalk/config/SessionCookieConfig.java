package com.tennotalk.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/**
 * The session cookie is the credential (PLAN.md §30): never readable by scripts, sent only
 * same-site, HTTPS-only in production. Declared explicitly so it never depends on auto-configuration
 * (the server.servlet.session.cookie.* properties did not reach the Spring Session cookie).
 */
@Configuration
public class SessionCookieConfig {

    @Bean
    CookieSerializer sessionCookieSerializer(@Value("${tenno.cookie-secure:true}") boolean secure) {
        DefaultCookieSerializer serializer = new DefaultCookieSerializer();
        serializer.setCookieName("SESSION");
        serializer.setCookiePath("/");
        serializer.setUseHttpOnlyCookie(true);
        serializer.setSameSite("Lax");
        serializer.setUseSecureCookie(secure);
        serializer.setCookieMaxAge(60 * 60 * 24 * 30);
        return serializer;
    }
}
