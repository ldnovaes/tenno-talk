package com.tennotalk.recommender.learning;

import java.util.Locale;
import java.util.Optional;

/** What a viewer did with a post (PLAN.md §37.5). The code is the wire and database value. */
public enum InteractionKind {
    IMPRESSION("impression"),
    DWELL("dwell"),
    LIKE("like"),
    UNLIKE("unlike"),
    COMMENT("comment"),
    SHARE("share"),
    PROFILE_OPEN("profile_open"),
    FOLLOW("follow"),
    UNFOLLOW("unfollow"),
    MESSAGE_AUTHOR("message_author"),
    HIDE_POST("hide_post"),
    HIDE_AUTHOR("hide_author"),
    REPORT("report");

    private final String code;

    InteractionKind(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static Optional<InteractionKind> fromCode(String code) {
        if (code == null) return Optional.empty();
        String normalized = code.strip().toLowerCase(Locale.ROOT);
        for (InteractionKind kind : values()) if (kind.code.equals(normalized)) return Optional.of(kind);
        return Optional.empty();
    }
}
