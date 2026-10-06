package com.tennotalk.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.support.HttpSessionHandshakeInterceptor;

import com.tennotalk.realtime.RealtimeWebSocketHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final RealtimeWebSocketHandler handler;
    private final TennoProperties properties;

    public WebSocketConfig(RealtimeWebSocketHandler handler, TennoProperties properties) {
        this.handler = handler;
        this.properties = properties;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Cookie-authenticated socket: only our own origin may open it (cross-site WebSocket hijacking).
        // Each socket remembers its HTTP session (only the id), so signing out closes exactly its sockets.
        HttpSessionHandshakeInterceptor sessionId = new HttpSessionHandshakeInterceptor();
        sessionId.setCopyAllAttributes(false);
        sessionId.setCopyHttpSessionId(true);
        registry.addHandler(handler, "/ws").addInterceptors(sessionId).setAllowedOrigins(properties.publicUrl());
    }
}
