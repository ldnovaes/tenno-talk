package com.tennotalk.auth;

import org.springframework.security.web.csrf.CsrfTokenRequestHandler;

public final class CsrfConfig {

    private CsrfConfig() {}

    public static CsrfTokenRequestHandler spaHandler() {
        return new SpaCsrfTokenRequestHandler();
    }
}
