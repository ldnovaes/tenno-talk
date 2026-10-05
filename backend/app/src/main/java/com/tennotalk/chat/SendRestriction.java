package com.tennotalk.chat;

/**
 * Why someone can't message a person directly right now (PLAN.md §31.1). {@code UNAVAILABLE} covers both "they
 * blocked you" and "they accept messages from nobody", so a block is never revealed.
 */
public enum SendRestriction {
    YOU_BLOCKED("You blocked this person."),
    FOLLOWERS_ONLY("This person only accepts messages from people they follow."),
    UNAVAILABLE("Messaging is unavailable.");

    private final String message;

    SendRestriction(String message) {
        this.message = message;
    }

    public String message() {
        return message;
    }

    /** As sent to the frontend ({@code ConversationDto.sendRestriction}). */
    public String wireName() {
        return name().toLowerCase();
    }
}
