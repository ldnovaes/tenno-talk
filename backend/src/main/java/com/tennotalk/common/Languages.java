package com.tennotalk.common;

import java.util.Locale;
import java.util.Set;

/** BCP-47 helpers shared by translation and projections (mirrors src/lib/languages.ts). */
public final class Languages {

    public static final Set<String> SUPPORTED = Set.of(
            "pt-BR", "pt-PT", "en-US", "en-GB", "es-ES", "vi-VN", "fr-FR", "de-DE", "it-IT",
            "ja-JP", "ko-KR", "zh-CN", "th-TH", "ar", "hi-IN", "ru-RU");

    private Languages() {}

    public static String base(String code) {
        int dash = code.indexOf('-');
        return (dash < 0 ? code : code.substring(0, dash)).toLowerCase(Locale.ROOT);
    }

    /** pt-BR and pt-PT are "the same language" for translation purposes. */
    public static boolean same(String a, String b) {
        return base(a).equals(base(b));
    }

    public static boolean isSupported(String code) {
        return code != null && SUPPORTED.contains(code);
    }

    /** English display name used in AI prompts, e.g. "Vietnamese (Vietnam)". */
    public static String displayName(String code) {
        Locale locale = Locale.forLanguageTag(code);
        String name = locale.getDisplayName(Locale.ENGLISH);
        return name.isBlank() ? code : name;
    }
}
