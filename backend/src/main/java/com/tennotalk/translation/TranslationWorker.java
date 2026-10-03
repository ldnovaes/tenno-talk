package com.tennotalk.translation;

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import com.tennotalk.chat.ChatEvents.TranslationChanged;
import com.tennotalk.chat.ChatRepository;
import com.tennotalk.chat.MemberRow;
import com.tennotalk.chat.MessageRow;
import com.tennotalk.config.TennoProperties;

/**
 * Translation worker (PLAN.md §28.2): claims queued jobs, calls the provider chain
 * outside any transaction, then stores a new version and notifies the members.
 */
@Component
public class TranslationWorker {

    private static final Logger log = LoggerFactory.getLogger(TranslationWorker.class);

    private final TranslationJobRepository jobs;
    private final MessageTranslationRepository messages;
    private final ContentTranslationRepository contents;
    private final ChatRepository chat;
    private final FallbackTranslator translator;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate tx;
    private final TennoProperties.Translation config;
    private final Map<String, ContentSource> sources = new HashMap<>();
    private final Clock clock;

    public TranslationWorker(TranslationJobRepository jobs, MessageTranslationRepository messages,
            ContentTranslationRepository contents, ChatRepository chat, FallbackTranslator translator,
            ApplicationEventPublisher events, TransactionTemplate tx, TennoProperties properties,
            org.springframework.beans.factory.ObjectProvider<ContentSource> contentSources, Clock clock) {
        this.jobs = jobs;
        this.messages = messages;
        this.contents = contents;
        this.chat = chat;
        this.translator = translator;
        this.events = events;
        this.tx = tx;
        this.config = properties.translation();
        this.clock = clock;
        contentSources.orderedStream().forEach(source -> sources.put(source.kind(), source));
    }

    @Scheduled(fixedDelayString = "${tenno.translation.poll-interval:500ms}")
    public void poll() {
        if (config.workerEnabled()) runOnce();
    }

    /** Processes one batch; returns how many jobs were handled (tests call it directly). */
    public int runOnce() {
        List<TranslationJobRepository.Job> batch = tx.execute(status -> {
            jobs.releaseStale(clock.instant().minus(config.timeout().multipliedBy(4)));
            List<TranslationJobRepository.Job> claimed = jobs.claim(config.batchSize(), clock.instant());
            claimed.stream().filter(job -> "message".equals(job.kind())).forEach(job -> {
                messages.setStatus(job.refId(), job.targetLanguage(), "translating", null, clock.instant());
                publishMessageChange(job);
            });
            return claimed;
        });
        if (batch == null) return 0;
        for (TranslationJobRepository.Job job : batch) {
            try {
                process(job);
            } catch (RuntimeException exception) {
                log.error("Translation job {} crashed", job.id(), exception);
                tx.executeWithoutResult(status -> jobs.retryLater(job.id(), clock.instant().plusSeconds(30), exception.getMessage()));
            }
        }
        return batch.size();
    }

    /** A provider is back: every waiting job returns to the queue (PLAN.md §28.3). */
    @EventListener
    public void onProviderRecovered(ProviderRecovered event) {
        int resumed = jobs.resumeWaiting(clock.instant());
        if (resumed > 0) log.info("Provider {} recovered: {} translation jobs resumed", event.provider(), resumed);
    }

    private void process(TranslationJobRepository.Job job) {
        TranslationRequest request = "message".equals(job.kind()) ? messageRequest(job) : contentRequest(job);
        if (request == null) {
            tx.executeWithoutResult(status -> jobs.done(job.id()));
            return;
        }
        TranslationOutcome outcome = translator.translate(request);
        tx.executeWithoutResult(status -> apply(job, outcome));
    }

    private TranslationRequest messageRequest(TranslationJobRepository.Job job) {
        MessageRow message = chat.findMessage(job.refId()).orElse(null);
        if (message == null || message.originalText() == null) return null;
        Map<UUID, String> names = new HashMap<>();
        for (MemberRow member : chat.members(message.conversationId())) names.put(member.user().id(), member.user().displayName());
        List<TranslationRequest.ContextLine> context = new ArrayList<>();
        for (MessageRow previous : chat.before(message.conversationId(), message.createdAt(), message.id(), config.contextMessages())) {
            if (previous.originalText() != null) {
                context.add(new TranslationRequest.ContextLine(names.getOrDefault(previous.senderId(), "Someone"), previous.originalText()));
            }
        }
        return new TranslationRequest(message.originalText(), message.originalLanguage(), job.targetLanguage(), context);
    }

    private TranslationRequest contentRequest(TranslationJobRepository.Job job) {
        ContentSource source = sources.get(job.kind());
        if (source == null) return null;
        return source.original(job.refId())
                .map(original -> TranslationRequest.of(original.text(), original.language(), job.targetLanguage()))
                .orElse(null);
    }

    private void apply(TranslationJobRepository.Job job, TranslationOutcome outcome) {
        boolean message = "message".equals(job.kind());
        switch (outcome) {
            case TranslationOutcome.Success success -> {
                if (message) {
                    messages.saveTranslated(job.refId(), job.targetLanguage(), success.result().natural(),
                            success.result().literal(), success.result().provider(), clock.instant());
                } else {
                    contents.saveTranslated(job.kind(), job.refId(), job.targetLanguage(), success.result().natural(), clock.instant());
                }
                jobs.done(job.id());
            }
            case TranslationOutcome.Unavailable unavailable -> {
                // Message stays readable in the original; nothing is lost (PLAN.md §28.3).
                if (message) messages.setStatus(job.refId(), job.targetLanguage(), "pending", unavailable.reason(), clock.instant());
                jobs.waitForProvider(job.id(), unavailable.reason());
            }
            case TranslationOutcome.Failed failed -> {
                if (job.attempts() + 1 >= config.maxAttempts()) {
                    if (message) messages.setStatus(job.refId(), job.targetLanguage(), "failed", failed.error(), clock.instant());
                    else contents.saveStatus(job.kind(), job.refId(), job.targetLanguage(), "failed", clock.instant());
                    jobs.fail(job.id(), failed.error());
                } else {
                    if (message) messages.setStatus(job.refId(), job.targetLanguage(), "pending", failed.error(), clock.instant());
                    jobs.retryLater(job.id(), clock.instant().plus(backoff(job.attempts())), failed.error());
                }
            }
        }
        if (message) publishMessageChange(job);
    }

    static Duration backoff(int attempts) {
        return Duration.ofSeconds(5L << Math.min(attempts, 6));
    }

    private void publishMessageChange(TranslationJobRepository.Job job) {
        chat.findMessage(job.refId()).ifPresent(message ->
                events.publishEvent(new TranslationChanged(message.conversationId(), message.id(), job.targetLanguage())));
    }

}
