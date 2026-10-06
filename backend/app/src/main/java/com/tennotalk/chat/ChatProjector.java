package com.tennotalk.chat;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.tennotalk.chat.ChatDtos.ContentTranslationDto;
import com.tennotalk.chat.ChatDtos.FileContent;
import com.tennotalk.chat.ChatDtos.ImageContent;
import com.tennotalk.chat.ChatDtos.MessageContentDto;
import com.tennotalk.chat.ChatDtos.MessageDto;
import com.tennotalk.chat.ChatDtos.MessageReferenceDto;
import com.tennotalk.chat.ChatDtos.OriginalTextDto;
import com.tennotalk.chat.ChatDtos.ReactionSummaryDto;
import com.tennotalk.chat.ChatDtos.StoryReactionContent;
import com.tennotalk.chat.ChatDtos.StoryReplyContent;
import com.tennotalk.chat.ChatDtos.TextContent;
import com.tennotalk.chat.ChatDtos.VideoContent;
import com.tennotalk.common.Languages;
import com.tennotalk.media.MediaRepository;
import com.tennotalk.media.MediaRow;
import com.tennotalk.translation.MessageTranslationRepository;

/**
 * Projects messages for ONE viewer (PLAN.md §12): the translation is the one into the
 * receiving language the viewer had when the message was sent (or, for own messages, what
 * the other person received), and ticks come from the other members' cursors.
 */
@Component
public class ChatProjector {

    /** Conversation data needed to project its messages. */
    public record Scope(String kind, List<MemberRow> members, ReceivingLanguages languages) {

        MemberRow member(UUID userId) {
            return members.stream().filter(m -> m.user().id().equals(userId)).findFirst().orElse(null);
        }

    }

    private final MessageReceipts receipts;
    private final ChatRepository chat;
    private final MediaRepository media;
    private final MessageTranslationRepository translations;

    public ChatProjector(ChatRepository chat, MediaRepository media, MessageTranslationRepository translations, MessageReceipts receipts) {
        this.receipts = receipts;
        this.chat = chat;
        this.media = media;
        this.translations = translations;
    }

    /**
     * Language this viewer should read the message in: the receiving language in effect when it
     * was sent, so a later change never re-translates the past. Null when there is nothing to show.
     */
    public static String targetFor(MessageRow message, UUID viewer, Scope scope) {
        if (!message.senderId().equals(viewer)) {
            MemberRow me = scope.member(viewer);
            return me == null ? null : scope.languages().of(me, message.createdAt());
        }
        if ("group".equals(scope.kind())) return null;
        return scope.members().stream()
                .filter(m -> !m.user().id().equals(viewer))
                .map(m -> scope.languages().of(m, message.createdAt()))
                .findFirst()
                .orElse(null);
    }

    public MessageDto one(UUID viewer, MessageRow message, Scope scope) {
        return many(viewer, List.of(message), Map.of(message.conversationId(), scope)).getFirst();
    }

    public List<MessageDto> many(UUID viewer, List<MessageRow> messages, Map<UUID, Scope> scopes) {
        if (messages.isEmpty()) return List.of();
        Set<UUID> replyIds = new HashSet<>();
        messages.forEach(m -> {
            if (m.replyToId() != null) replyIds.add(m.replyToId());
        });
        Map<UUID, MessageRow> replied = chat.findMessages(replyIds);
        Set<UUID> ids = new HashSet<>(replied.keySet());
        messages.forEach(m -> ids.add(m.id()));
        Map<UUID, List<MediaRow>> mediaByMessage = media.forMessages(ids);
        Map<UUID, List<ChatRepository.ReactionRow>> reactions = chat.reactions(ids);
        Map<String, MessageTranslationRepository.Row> translated = translations.forMessages(ids);

        Map<UUID, String> statuses = receipts.statuses(messages);
        List<MessageDto> result = new ArrayList<>(messages.size());
        for (MessageRow message : messages) {
            Scope scope = Objects.requireNonNull(scopes.get(message.conversationId()), "scope");
            MessageReferenceDto reply = null;
            MessageRow quoted = message.replyToId() == null ? null : replied.get(message.replyToId());
            if (quoted != null) {
                Preview shown = preview(quoted, viewer, scope, translated, mediaByMessage);
                reply = new MessageReferenceDto(quoted.id(), quoted.senderId(), shown.text(), shown.language());
            }
            result.add(new MessageDto(
                    message.id(),
                    message.clientId(),
                    message.conversationId(),
                    message.senderId(),
                    content(message, mediaByMessage.getOrDefault(message.id(), List.of())),
                    translation(message, targetFor(message, viewer, scope), translated),
                    reply,
                    summarize(reactions.getOrDefault(message.id(), List.of()), viewer),
                    message.senderId().equals(viewer) ? statuses.getOrDefault(message.id(), deliveryStatus(message, viewer, scope)) : "read",
                    message.createdAt()));
        }
        return result;
    }

    static ContentTranslationDto translation(MessageRow message, String target,
            Map<String, MessageTranslationRepository.Row> translated) {
        if (message.originalText() == null || target == null || "story_reaction".equals(message.type())) return null;
        if (Languages.same(message.originalLanguage(), target)) {
            return new ContentTranslationDto(target, null, "not_needed", 0, message.createdAt());
        }
        // Every target gets its row when the message is sent; no row means old data: show the original.
        MessageTranslationRepository.Row row = translated.get(MessageTranslationRepository.key(message.id(), target));
        return row != null ? row.toDto() : null;
    }

    static String deliveryStatus(MessageRow message, UUID viewer, Scope scope) {
        if (!message.senderId().equals(viewer)) return "read";
        List<DeliveryStatus.MemberCursor> others = scope.members().stream()
                .filter(m -> !m.user().id().equals(viewer))
                .map(m -> new DeliveryStatus.MemberCursor(m.lastDeliveredAt(), m.lastReadAt()))
                .toList();
        return DeliveryStatus.derive(message.createdAt(), others);
    }

    static MessageContentDto content(MessageRow message, List<MediaRow> attachments) {
        OriginalTextDto text = message.originalText() == null ? null : new OriginalTextDto(message.originalText(), message.originalLanguage());
        return switch (message.type()) {
            case "image" -> new ImageContent(attachments.stream().map(MediaRow::toDto).toList(), text);
            case "video" -> new VideoContent(attachments.isEmpty() ? null : attachments.getFirst().toDto(), text);
            case "file" -> new FileContent(attachments.isEmpty() ? null : attachments.getFirst().toDto(),
                    attachments.isEmpty() ? "" : attachments.getFirst().originalName());
            case "story_reply" -> new StoryReplyContent(message.storyId(), text);
            case "story_reaction" -> new StoryReactionContent(message.storyId(), message.originalText());
            default -> new TextContent(text);
        };
    }

    static List<ReactionSummaryDto> summarize(Collection<ChatRepository.ReactionRow> rows, UUID viewer) {
        Map<String, int[]> counts = new LinkedHashMap<>();
        Map<String, Boolean> mine = new LinkedHashMap<>();
        for (ChatRepository.ReactionRow row : rows) {
            counts.computeIfAbsent(row.emoji(), key -> new int[1])[0]++;
            mine.merge(row.emoji(), row.userId().equals(viewer), Boolean::logicalOr);
        }
        return counts.entrySet().stream()
                .map(entry -> new ReactionSummaryDto(entry.getKey(), entry.getValue()[0], mine.get(entry.getKey())))
                .toList();
    }

    /** A quoted message as the viewer reads it, and in which language (for the {@code lang} of the quote). */
    record Preview(String text, String language) {}

    private static Preview preview(MessageRow message, UUID viewer, Scope scope,
            Map<String, MessageTranslationRepository.Row> translated, Map<UUID, List<MediaRow>> mediaByMessage) {
        if (message.originalText() == null) {
            return new Preview(mediaByMessage.getOrDefault(message.id(), List.of()).isEmpty() ? "" : "📷", null);
        }
        ContentTranslationDto translation = translation(message, targetFor(message, viewer, scope), translated);
        boolean showTranslation = !message.senderId().equals(viewer) && translation != null
                && "translated".equals(translation.status()) && translation.text() != null;
        return showTranslation
                ? new Preview(translation.text(), translation.targetLanguage())
                : new Preview(message.originalText(), "story_reaction".equals(message.type()) ? null : message.originalLanguage());
    }
}
