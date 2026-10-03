package com.tennotalk.auth;

import java.util.List;
import java.util.Locale;

import com.tennotalk.common.Languages;

/**
 * Picks a supported language from the device languages (Accept-Language).
 * Same rule as detectSystemLanguage() in the frontend (PLAN.md §34, decision 4).
 */
public final class AcceptLanguage {

    private static final List<String> ORDER = List.of(
            "pt-BR", "pt-PT", "en-US", "en-GB", "es-ES", "vi-VN", "fr-FR", "de-DE", "it-IT",
            "ja-JP", "ko-KR", "zh-CN", "th-TH", "ar", "hi-IN", "ru-RU");

    private AcceptLanguage() {}

    public static String detect(String header) {
        if (header == null || header.isBlank()) return "en-US";
        List<Locale.LanguageRange> ranges;
        try {
            ranges = Locale.LanguageRange.parse(header);
        } catch (IllegalArgumentException exception) {
            return "en-US";
        }
        for (Locale.LanguageRange range : ranges) {
            String tag = range.getRange();
            for (String code : ORDER) {
                if (code.equalsIgnoreCase(tag)) return code;
            }
            for (String code : ORDER) {
                if (!tag.equals("*") && Languages.same(code, tag)) return code;
            }
        }
        return "en-US";
    }
}
