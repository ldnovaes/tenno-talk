package com.tennotalk.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

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
        registry.addHandler(handler, "/ws").setAllowedOrigins(properties.publicUrl());
    }
}
