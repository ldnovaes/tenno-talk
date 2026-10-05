package com.tennotalk.realtime;

import java.security.Principal;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.tennotalk.auth.AppPrincipal;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** /ws — authenticated by the same session cookie as the REST API (PLAN.md §26). */
@Component
public class RealtimeWebSocketHandler extends TextWebSocketHandler {

    private static final String USER_ATTRIBUTE = "tenno.userId";
    private static final String DECORATED_ATTRIBUTE = "tenno.session";
    private static final TextMessage PONG = new TextMessage("{\"type\":\"pong\",\"payload\":{}}");

    private final RealtimeHub hub;
    private final JsonMapper json;
    private final TypingSessions typing;

    public RealtimeWebSocketHandler(RealtimeHub hub, JsonMapper json, TypingSessions typing) {
        this.hub = hub;
        this.json = json;
        this.typing = typing;
    }

    static UUID userOf(Principal principal) {
        if (principal instanceof Authentication authentication && authentication.getPrincipal() instanceof AppPrincipal app) {
            return app.userId();
        }
        return null;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        UUID userId = userOf(session.getPrincipal());
        if (userId == null) {
            session.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        session.getAttributes().put(USER_ATTRIBUTE, userId);
        session.getAttributes().put(DECORATED_ATTRIBUTE, hub.register(userId, session));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        UUID userId = (UUID) session.getAttributes().get(USER_ATTRIBUTE);
        if (userId == null) return;
        ClientMessage parsed;
        try {
            parsed = json.readValue(message.getPayload(), ClientMessage.class);
        } catch (JacksonException exception) {
            return;
        }
        if ("ping".equals(parsed.type())) {
            // Application-level heartbeat: browsers cannot send WebSocket ping frames (PLAN.md §26).
            WebSocketSession decorated = (WebSocketSession) session.getAttributes().get(DECORATED_ATTRIBUTE);
            try {
                (decorated == null ? session : decorated).sendMessage(PONG);
            } catch (java.io.IOException closed) {
                // The close callback cleans up.
            }
            return;
        }
        if ("typing".equals(parsed.type()) && parsed.conversationId() != null) {
            typing.update(session.getId(), userId, parsed.conversationId(), Boolean.TRUE.equals(parsed.isTyping()));
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        typing.close(session.getId());
        UUID userId = (UUID) session.getAttributes().get(USER_ATTRIBUTE);
        WebSocketSession decorated = (WebSocketSession) session.getAttributes().get(DECORATED_ATTRIBUTE);
        if (userId != null) hub.unregister(userId, decorated == null ? session : decorated);
    }
}
