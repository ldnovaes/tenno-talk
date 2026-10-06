package com.tennotalk.common;

/** SQL LIKE patterns built from user text: the text is matched literally, never as wildcards. */
public final class LikePatterns {

    private LikePatterns() {}

    /** "50%_off" → "%50\%\_off%": matches the text anywhere (PostgreSQL's default escape is the backslash). */
    public static String contains(String text) {
        String escaped = text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
