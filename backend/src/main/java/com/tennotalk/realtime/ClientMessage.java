package com.tennotalk.realtime;

import java.util.UUID;

/** Messages a client may send over the socket (only typing for now). */
public record ClientMessage(String type, UUID conversationId, Boolean isTyping) {}
