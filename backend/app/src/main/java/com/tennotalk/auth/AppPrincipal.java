package com.tennotalk.auth;

import java.io.Serial;
import java.io.Serializable;
import java.util.UUID;

import org.springframework.security.core.AuthenticatedPrincipal;

/** The authenticated user stored in the session (serializable for Spring Session JDBC). */
public record AppPrincipal(UUID userId) implements AuthenticatedPrincipal, Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    @Override
    public String getName() {
        return userId.toString();
    }
}
