package com.tennotalk.chat;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.tennotalk.chat.ReceivingLanguages.Period;
import com.tennotalk.users.UserDtos.UserDto;

import static org.assertj.core.api.Assertions.assertThat;

class ReceivingLanguagesTest {

    private final UUID linh = UUID.randomUUID();
    private final Instant created = Instant.parse("2026-10-01T00:00:00Z");
    private final Instant changed = Instant.parse("2026-10-04T12:00:00Z");
    private final ReceivingLanguages history = new ReceivingLanguages(Map.of(linh, List.of(
            new Period("vi-VN", created), new Period("en-US", changed))));

    @Test
    void theLanguageInEffectWhenTheMessageWasSent() {
        assertThat(history.at(linh, changed.minusSeconds(1))).isEqualTo("vi-VN");
        assertThat(history.at(linh, changed)).isEqualTo("en-US");
        assertThat(history.at(linh, changed.plusSeconds(3600))).isEqualTo("en-US");
    }

    @Test
    void noAnswerBeforeTheHistoryOrForUnknownUsers() {
        assertThat(history.at(linh, created.minusSeconds(1))).isNull();
        assertThat(history.at(UUID.randomUUID(), changed)).isNull();
    }

    @Test
    void aMemberWithoutHistoryFallsBackToTheCurrentLanguage() {
        MemberRow member = new MemberRow(UUID.randomUUID(), new UserDto(UUID.randomUUID(), "sofia", "Sofia", null),
                "member", "es-ES", null, null, null, null, null);
        assertThat(ReceivingLanguages.NONE.of(member, changed)).isEqualTo("es-ES");
    }
}
