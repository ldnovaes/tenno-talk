package com.tennotalk.chat;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.tennotalk.common.ApiException;
import com.tennotalk.media.MediaRow;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ChatRulesTest {

    private final Instant at = Instant.parse("2026-10-03T12:00:00Z");

    private static DeliveryStatus.MemberCursor cursor(Instant delivered, Instant read) {
        return new DeliveryStatus.MemberCursor(delivered, read);
    }

    @Test
    void ticksFollowTheCursorsOfEveryOtherMember() {
        assertThat(DeliveryStatus.derive(at, List.of())).isEqualTo("sent");
        assertThat(DeliveryStatus.derive(at, List.of(cursor(null, null)))).isEqualTo("sent");
        assertThat(DeliveryStatus.derive(at, List.of(cursor(at.minusSeconds(1), null)))).isEqualTo("sent");
        assertThat(DeliveryStatus.derive(at, List.of(cursor(at, null)))).isEqualTo("delivered");
        assertThat(DeliveryStatus.derive(at, List.of(cursor(null, at.plusSeconds(1))))).isEqualTo("read");
        // Groups: read only when everyone read.
        assertThat(DeliveryStatus.derive(at, List.of(cursor(null, at), cursor(at, null)))).isEqualTo("delivered");
        assertThat(DeliveryStatus.derive(at, List.of(cursor(null, at), cursor(null, null)))).isEqualTo("sent");
    }

    @Test
    void translationTargetsSkipTheOriginalLanguageAndDuplicates() {
        assertThat(TranslationTargets.compute("pt-BR", List.of("pt-BR", "vi-VN", "vi-VN", "es-ES", "pt-PT")))
                .containsExactly("vi-VN", "es-ES");
        assertThat(TranslationTargets.compute("vi-VN", List.of("vi-VN"))).isEmpty();
        java.util.ArrayList<String> withNull = new java.util.ArrayList<>(List.of("en-US"));
        withNull.add(null);
        assertThat(TranslationTargets.compute("pt-BR", withNull)).containsExactly("en-US");
    }

    @Test
    void directKeysDoNotDependOnWhoStarts() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        assertThat(ChatService.directKey(a, b)).isEqualTo(ChatService.directKey(b, a));
    }

    private static MediaRow media(String kind) {
        return new MediaRow(UUID.randomUUID(), UUID.randomUUID(), kind, "x/y", 1, null, null, null, "p", "n", Instant.now());
    }

    @Test
    void messageTypeComesFromTheAttachments() {
        assertThat(ChatService.typeOf(List.of())).isEqualTo("text");
        assertThat(ChatService.typeOf(List.of(media("image"), media("image")))).isEqualTo("image");
        assertThat(ChatService.typeOf(List.of(media("video")))).isEqualTo("video");
        assertThat(ChatService.typeOf(List.of(media("file")))).isEqualTo("file");
        assertThatThrownBy(() -> ChatService.typeOf(List.of(media("video"), media("image")))).isInstanceOf(ApiException.class);
    }

    @Test
    void reactionsAreSummarizedInOrderOfFirstUse() {
        UUID me = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        UUID message = UUID.randomUUID();
        var summary = ChatProjector.summarize(List.of(
                new ChatRepository.ReactionRow(message, other, "😂"),
                new ChatRepository.ReactionRow(message, me, "❤️"),
                new ChatRepository.ReactionRow(message, other, "❤️")), me);
        assertThat(summary).extracting(ChatDtos.ReactionSummaryDto::emoji).containsExactly("😂", "❤️");
        assertThat(summary.get(1).count()).isEqualTo(2);
        assertThat(summary.get(1).reactedByMe()).isTrue();
        assertThat(summary.get(0).reactedByMe()).isFalse();
    }

    @Test
    void ownMessagesInGroupsHaveNoSingleTarget() {
        UUID me = UUID.randomUUID();
        var message = new MessageRow(UUID.randomUUID(), UUID.randomUUID(), me, "c", "text", "Oi", "pt-BR", null, null, at);
        var scope = new ChatProjector.Scope("group", List.of(), ReceivingLanguages.NONE);
        assertThat(ChatProjector.targetFor(message, me, scope)).isNull();
    }
}
