package com.tennotalk.auth;

import java.util.List;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Component;

import com.tennotalk.realtime.RealtimeHub;

/** Puts an {@link AppPrincipal} in the HTTP session (the session cookie is the credential). */
@Component
public class SessionLogin {

    private final SecurityContextHolderStrategy strategy = SecurityContextHolder.getContextHolderStrategy();
    private final SecurityContextRepository repository = new HttpSessionSecurityContextRepository();
    private final FindByIndexNameSessionRepository<? extends Session> sessions;
    private final RealtimeHub hub;

    public SessionLogin(FindByIndexNameSessionRepository<? extends Session> sessions, RealtimeHub hub) {
        this.sessions = sessions;
        this.hub = hub;
    }

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

    /** Ends this browser's session and its open sockets (other devices stay signed in). */
    public void logout(HttpServletRequest request) {
        UUID userId = currentUser();
        strategy.clearContext();
        var session = request.getSession(false);
        if (session == null) return;
        String id = session.getId();
        session.invalidate();
        if (userId != null) hub.closeHttpSession(userId, id);
    }

    /**
     * After a password change (PLAN.md §38): every other session of the account ends, sockets included. A stolen
     * session cookie stops working the moment the owner changes the password.
     */
    public void endOtherSessions(UUID userId, HttpServletRequest request) {
        var current = request.getSession(false);
        String keep = current == null ? null : current.getId();
        sessions.findByPrincipalName(userId.toString()).keySet().stream()
                .filter(id -> !id.equals(keep))
                .forEach(sessions::deleteById);
        hub.closeOtherHttpSessions(userId, keep);
    }

    /** Account deleted: no session or socket of it survives. */
    public void endAllSessions(UUID userId, HttpServletRequest request) {
        logout(request);
        sessions.findByPrincipalName(userId.toString()).keySet().forEach(sessions::deleteById);
        hub.closeOtherHttpSessions(userId, null);
    }

    private UUID currentUser() {
        var authentication = strategy.getContext().getAuthentication();
        return authentication != null && authentication.getPrincipal() instanceof AppPrincipal principal ? principal.userId() : null;
    }
}
