package com.tennotalk.common;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import com.tennotalk.auth.AcceptLanguage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CommonRulesTest {

    @Test
    void cursorsRoundTripAndRejectGarbage() {
        Cursor cursor = new Cursor(Instant.parse("2026-10-03T12:00:00.123456Z"), UUID.randomUUID());
        assertThat(Cursor.decode(cursor.encode())).isEqualTo(cursor);
        assertThat(cursor.encode()).doesNotContain("=", "+", "/");
        assertThat(Cursor.decodeOrNull(null)).isNull();
        assertThat(Cursor.decodeOrNull(" ")).isNull();
        assertThatThrownBy(() -> Cursor.decode("nope")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> Cursor.decode("bm8tc2VwYXJhdG9y")).isInstanceOf(ApiException.class);
    }

    @ParameterizedTest
    @CsvSource({"ab,length", "aaaaaaaaaaaaaaaaaaaaa,length", "1abc,format", "ab-c,format", "ab..c,dots", "abc.,dots", "admin,reserved"})
    void invalidUsernames(String value, String problem) {
        assertThat(Usernames.problem(value)).contains(problem);
    }

    @ParameterizedTest
    @ValueSource(strings = {"cam", "lucas.a", "mai_92", "@Cam_Nguyen"})
    void validUsernames(String value) {
        assertThat(Usernames.problem(value)).isEmpty();
    }

    @Test
    void usernamesAreNormalized() {
        assertThat(Usernames.normalize("  @Cam_Nguyen ")).isEqualTo("cam_nguyen");
        assertThat(Usernames.normalize(null)).isEmpty();
    }

    @Test
    void languagesCompareByBase() {
        assertThat(Languages.same("pt-BR", "pt-PT")).isTrue();
        assertThat(Languages.same("pt-BR", "vi-VN")).isFalse();
        assertThat(Languages.base("ar")).isEqualTo("ar");
        assertThat(Languages.isSupported("vi-VN")).isTrue();
        assertThat(Languages.isSupported("xx-YY")).isFalse();
        assertThat(Languages.isSupported(null)).isFalse();
        assertThat(Languages.displayName("vi-VN")).isEqualTo("Vietnamese (Vietnam)");
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "vi-VN,vi;q=0.9,en;q=0.8 | vi-VN",
        "pt-BR | pt-BR",
        "pt | pt-BR",
        "es-MX,es;q=0.9 | es-ES",
        "xx,fr-CA;q=0.5 | fr-FR",
        "* | en-US",
        "'' | en-US",
        "not a header ;;; | en-US",
    })
    void deviceLanguageIsDetectedLikeTheFrontend(String header, String expected) {
        assertThat(AcceptLanguage.detect(header)).isEqualTo(expected);
    }

    @Test
    void idsParseOrNotFound() {
        UUID id = UUID.randomUUID();
        assertThat(Ids.parse(id.toString())).isEqualTo(id);
        assertThatThrownBy(() -> Ids.parse("x")).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.code()).isEqualTo(ErrorCode.NOT_FOUND));
    }

    @Test
    void errorCodesMapToHttpStatusesAndWireNames() {
        assertThat(ErrorCode.RATE_LIMITED.status().value()).isEqualTo(429);
        assertThat(ErrorCode.RATE_LIMITED.wireName()).isEqualTo("rate_limited");
        assertThat(Problems.of(ErrorCode.CONFLICT, "x").getProperties()).containsEntry("code", "conflict");
    }
}
