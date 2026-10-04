package com.tennotalk.chat;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.tennotalk.chat.ChatEvents.MessageCreated;
import com.tennotalk.chat.ChatEvents.MessageUpdated;
import com.tennotalk.chat.ChatEvents.ReactionChanged;
import com.tennotalk.chat.ChatEvents.ReceiptChanged;
import com.tennotalk.chat.ChatEvents.TranslationChanged;
import com.tennotalk.realtime.PresenceChanged;
import com.tennotalk.realtime.RealtimeHub;
import com.tennotalk.realtime.TypingReceived;

/**
 * Pushes chat events to each member's sockets, projected for that member
 * (PLAN.md §26): the payloads are exactly the frontend RealtimeEventMap.
 */
@Component
public class ChatRealtime {

    private final RealtimeHub hub;
    private final ChatRepository chat;
    private final ChatProjector projector;
    private final ChatService service;
    private final JdbcClient jdbc;

    public ChatRealtime(RealtimeHub hub, ChatRepository chat, ChatProjector projector, ChatService service, JdbcClient jdbc) {
        this.hub = hub;
        this.chat = chat;
        this.projector = projector;
        this.service = service;
        this.jdbc = jdbc;
    }

    public void onCreated(MessageCreated event) {
        chat.findMessage(event.messageId()).ifPresent(message -> {
            ConversationRow conversation = chat.findConversation(event.conversationId()).orElseThrow();
            ChatProjector.Scope scope = service.scope(conversation);
            for (MemberRow member : scope.members()) {
                hub.send(member.user().id(), "message.created", Map.of("message", projector.one(member.user().id(), message, scope)));
            }
        });
    }

    public void onUpdated(MessageUpdated event) {
        chat.findMessage(event.messageId()).ifPresent(message -> {
            ChatProjector.Scope scope = service.scope(chat.findConversation(event.conversationId()).orElseThrow());
            for (MemberRow member : scope.members()) {
                hub.send(member.user().id(), "message.updated", Map.of("message", projector.one(member.user().id(), message, scope)));
            }
        });
    }

    public void onTranslation(TranslationChanged event) {
        chat.findMessage(event.messageId()).ifPresent(message -> {
            ChatProjector.Scope scope = service.scope(chat.findConversation(event.conversationId()).orElseThrow());
            for (MemberRow member : scope.members()) {
                UUID userId = member.user().id();
                if (!event.targetLanguage().equals(ChatProjector.targetFor(message, userId, scope))) continue;
                var projected = projector.one(userId, message, scope);
                if (projected.translation() == null) continue;
                hub.send(userId, "translation.updated", Map.of(
                        "conversationId", message.conversationId(),
                        "messageId", message.id(),
                        "translation", projected.translation()));
            }
        });
    }

    public void onReceipt(ReceiptChanged event) {
        boolean read = "read".equals(event.receipt());
        Map<String, Object> payload = read
                ? Map.of("conversationId", event.conversationId(), "readerId", event.userId(), "upToMessageId", event.upToMessageId())
                : Map.of("conversationId", event.conversationId(), "recipientId", event.userId(), "upToMessageId", event.upToMessageId());
        for (MemberRow member : chat.members(event.conversationId())) {
            if (member.user().id().equals(event.userId())) continue;
            hub.send(member.user().id(), read ? "message.read" : "message.delivered", payload);
        }
    }

    public void onReaction(ReactionChanged event) {
        Map<String, Object> payload = Map.of("conversationId", event.conversationId(), "messageId", event.messageId(),
                "userId", event.userId(), "emoji", event.emoji());
        for (MemberRow member : chat.members(event.conversationId())) {
            hub.send(member.user().id(), event.added() ? "reaction.created" : "reaction.deleted", payload);
        }
    }

    @EventListener
    public void onTyping(TypingReceived event) {
        if (!chat.isMember(event.conversationId(), event.userId())) return;
        Map<String, Object> payload = Map.of("conversationId", event.conversationId(), "userId", event.userId());
        for (MemberRow member : chat.members(event.conversationId())) {
            if (!member.user().id().equals(event.userId())) {
                hub.send(member.user().id(), event.typing() ? "typing.started" : "typing.stopped", payload);
            }
        }
    }

    /** Online/offline to everyone who shares a conversation with the user. */
    @EventListener
    public void onPresence(PresenceChanged event) {
        Set<UUID> contacts = new HashSet<>(jdbc.sql("""
                SELECT DISTINCT other.user_id FROM conversation_members mine
                JOIN conversation_members other ON other.conversation_id = mine.conversation_id AND other.user_id <> mine.user_id
                WHERE mine.user_id = :u
                """).param("u", event.userId()).query(UUID.class).list());
        Map<String, Object> payload = event.online()
                ? Map.of("userId", event.userId())
                : Map.of("userId", event.userId(), "lastSeenAt", event.at().toString());
        for (UUID contact : contacts) hub.send(contact, event.online() ? "user.online" : "user.offline", payload);
    }

}
