package com.tennotalk.translation;

import java.time.Clock;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tennotalk.chat.ChatDtos.ContentTranslationDto;
import com.tennotalk.chat.ChatDtos.OriginalTextDto;
import com.tennotalk.chat.ChatEvents.TranslationChanged;
import com.tennotalk.chat.ChatProjector;
import com.tennotalk.chat.ChatRepository;
import com.tennotalk.chat.ChatService;
import com.tennotalk.chat.ConversationRow;
import com.tennotalk.chat.MessageRow;
import com.tennotalk.common.ApiException;
import com.tennotalk.common.Languages;

/** Retry, Learning Mode insights and on-demand content translation (PLAN.md §14). */
@Service
public class TranslationService {

    public record InsightDto(UUID messageId, String targetLanguage, String natural, String literal, String explanation,
            List<Object> vocabulary, String pronunciation) {}

    private final ChatRepository chat;
    private final ChatService chatService;
    private final MessageTranslationRepository messages;
    private final ContentTranslationRepository contents;
    private final TranslationJobRepository jobs;
    private final FallbackTranslator translator;
    private final ApplicationEventPublisher events;
    private final Map<String, ContentSource> sources = new HashMap<>();
    private final Clock clock;

    public TranslationService(ChatRepository chat, ChatService chatService, MessageTranslationRepository messages,
            ContentTranslationRepository contents, TranslationJobRepository jobs, FallbackTranslator translator,
            ApplicationEventPublisher events, org.springframework.beans.factory.ObjectProvider<ContentSource> contentSources, Clock clock) {
        this.chat = chat;
        this.chatService = chatService;
        this.messages = messages;
        this.contents = contents;
        this.jobs = jobs;
        this.translator = translator;
        this.events = events;
        this.clock = clock;
        contentSources.orderedStream().forEach(source -> sources.put(source.kind(), source));
    }

    /** "Retry translation": back to the queue with fresh attempts. */
    @Transactional
    public ContentTranslationDto retry(UUID viewer, UUID messageId) {
        MessageRow message = chat.findMessage(messageId).orElseThrow(() -> ApiException.notFound("Message not found."));
        ConversationRow conversation = chatService.requireMember(message.conversationId(), viewer);
        ChatProjector.Scope scope = chatService.scope(conversation);
        String target = ChatProjector.targetFor(message, viewer, scope);
        if (message.originalText() == null || target == null || Languages.same(message.originalLanguage(), target)) {
            throw ApiException.validation("Nothing to translate.");
        }
        messages.resetForRetry(messageId, target, clock.instant());
        jobs.enqueue("message", messageId, target, clock.instant(), true);
        events.publishEvent(new TranslationChanged(message.conversationId(), messageId, target));
        return messages.find(messageId, target).orElseThrow().toDto();
    }

    @Transactional(readOnly = true)
    public InsightDto insight(UUID viewer, UUID messageId, String language) {
        MessageRow message = chat.findMessage(messageId).orElseThrow(() -> ApiException.notFound("Message not found."));
        chatService.requireMember(message.conversationId(), viewer);
        if (message.originalText() == null || Languages.same(message.originalLanguage(), language)) {
            throw ApiException.validation("This message does not need a translation.");
        }
        var row = messages.find(messageId, language)
                .filter(r -> "translated".equals(r.status()))
                .orElseThrow(() -> ApiException.notFound("The translation is not ready yet."));
        return new InsightDto(messageId, language, row.text(), row.literal() == null ? row.text() : row.literal(), null,
                List.of(), null);
    }

    /**
     * Captions, comments and story texts: translated on demand and cached. When no
     * provider is available it is queued and returned as pending.
     */
    @Transactional
    public ContentTranslationDto translateContent(UUID viewer, String kind, UUID id, String language) {
        ContentSource source = sources.get(kind);
        if (source == null) throw ApiException.notFound("Unknown content.");
        if (!Languages.isSupported(language)) throw ApiException.validation("Unsupported language.");
        OriginalTextDto original = source.originalFor(viewer, id).orElseThrow(() -> ApiException.notFound("Content not found."));
        if (Languages.same(original.language(), language)) {
            return new ContentTranslationDto(language, null, "not_needed", 0, clock.instant());
        }
        var cached = contents.find(kind, id, language);
        if (cached.isPresent() && "translated".equals(cached.get().status())) return cached.get();
        TranslationOutcome outcome = translator.translate(TranslationRequest.of(original.text(), original.language(), language));
        if (outcome instanceof TranslationOutcome.Success success) {
            contents.saveTranslated(kind, id, language, success.result().natural(), clock.instant());
        } else {
            contents.saveStatus(kind, id, language, "pending", clock.instant());
            jobs.enqueue(kind, id, language, clock.instant(), true);
        }
        return contents.find(kind, id, language).orElseThrow();
    }
}
