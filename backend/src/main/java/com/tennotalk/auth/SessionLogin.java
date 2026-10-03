package com.tennotalk.auth;

import java.util.List;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

/** Puts an {@link AppPrincipal} in the HTTP session (the session cookie is the credential). */
@Component
public class SessionLogin {

    private final SecurityContextHolderStrategy strategy = SecurityContextHolder.getContextHolderStrategy();
    private final SecurityContextRepository repository = new HttpSessionSecurityContextRepository();

    public void login(UUID userId, boolean admin, HttpServletRequest request, HttpServletResponse response) {
        // New session id on login: protects against session fixation.
        if (request.getSession(false) != null) request.changeSessionId();
        var authorities = admin
                ? List.of(new SimpleGrantedAuthority("ROLE_USER"), new SimpleGrantedAuthority("ROLE_ADMIN"))
                : List.of(new SimpleGrantedAuthority("ROLE_USER"));
        var authentication = UsernamePasswordAuthenticationToken.authenticated(new AppPrincipal(userId), null, authorities);
        SecurityContext context = strategy.createEmptyContext();
        context.setAuthentication(authentication);
        strategy.setContext(context);
        repository.saveContext(context, request, response);
    }

    public void logout(HttpServletRequest request) {
        strategy.clearContext();
        var session = request.getSession(false);
        if (session != null) session.invalidate();
    }
}
