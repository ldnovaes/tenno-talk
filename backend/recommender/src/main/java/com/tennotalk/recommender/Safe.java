package com.tennotalk.recommender;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Total normalizers: every model constructor goes through these, so bad input degrades instead of throwing. */
final class Safe {

    private Safe() {}

    static <T> Set<T> set(Collection<? extends T> values) {
        if (values == null || values.isEmpty()) return Set.of();
        Set<T> result = new HashSet<>();
        for (T value : values) if (value != null) result.add(value);
        return Set.copyOf(result);
    }

    static <K> Map<K, Double> finiteMap(Map<? extends K, ? extends Number> values) {
        if (values == null || values.isEmpty()) return Map.of();
        Map<K, Double> result = new HashMap<>();
        for (Map.Entry<? extends K, ? extends Number> entry : values.entrySet()) {
            if (entry == null || entry.getKey() == null || entry.getValue() == null) continue;
            double value = entry.getValue().doubleValue();
            if (Double.isFinite(value) && value != 0) result.put(entry.getKey(), value);
        }
        return Map.copyOf(result);
    }

    static final Instant EARLIEST = Instant.EPOCH;
    static final Instant LATEST = Instant.parse("9999-12-31T23:59:59Z");

    /** Keeps instants where epoch-millisecond arithmetic cannot overflow. */
    static Instant instant(Instant value, Instant fallback) {
        if (value == null) return fallback;
        if (value.isBefore(EARLIEST)) return EARLIEST;
        return value.isAfter(LATEST) ? LATEST : value;
    }

    static long count(long value) {
        return Math.max(0, value);
    }

    static String text(String value) {
        return value == null ? "" : value.strip();
    }

    /** "pt-BR", "PT_br" and "pt" all become "pt": the ranking compares languages, not regional variants. */
    static String language(String value) {
        String text = text(value).toLowerCase(Locale.ROOT);
        int separator = indexOfSeparator(text);
        return separator < 0 ? text : text.substring(0, separator);
    }

    static Set<String> languages(Collection<String> values) {
        if (values == null || values.isEmpty()) return Set.of();
        Set<String> result = new HashSet<>();
        for (String value : values) {
            String language = language(value);
            if (!language.isEmpty()) result.add(language);
        }
        return Set.copyOf(result);
    }

    private static int indexOfSeparator(String text) {
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if (c == '-' || c == '_') return i;
        }
        return -1;
    }
}
