package com.tennotalk.common;

import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/** Same rules as the frontend (src/lib/username.ts). */
public final class Usernames {

    private static final Pattern PATTERN = Pattern.compile("^[a-z][a-z0-9_.]{2,19}$");
    private static final Set<String> RESERVED =
            Set.of("admin", "root", "support", "tenno", "tennotalk", "settings", "me", "api");

    private Usernames() {}

    public static String normalize(String value) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.startsWith("@")) trimmed = trimmed.substring(1);
        return trimmed.toLowerCase(Locale.ROOT);
    }

    /** Problem code ("length", "format", "dots", "reserved") or empty when valid. */
    public static Optional<String> problem(String value) {
        String username = normalize(value);
        if (username.length() < 3 || username.length() > 20) return Optional.of("length");
        if (!PATTERN.matcher(username).matches()) return Optional.of("format");
        if (username.contains("..") || username.endsWith(".")) return Optional.of("dots");
        if (RESERVED.contains(username)) return Optional.of("reserved");
        return Optional.empty();
    }
}
