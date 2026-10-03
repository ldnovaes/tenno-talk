package com.tennotalk.chat;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class ChatInputs {

    private ChatInputs() {}

    public record SendMessage(
            @NotBlank @Size(max = 100) String clientId,
            @Size(max = 4000) String text,
            @Size(max = 10) List<UUID> mediaIds,
            UUID replyToId) {}

    public record MarkRead(@NotNull UUID messageId) {}

    public record React(@NotBlank @Size(max = 16) String emoji) {}

    public record Forward(@NotNull @Size(min = 1, max = 20) List<UUID> conversationIds) {}

    public record Mute(boolean muted) {}

    public record Direct(@NotNull UUID userId) {}

    public record CreateGroup(@NotBlank @Size(max = 60) String title, @NotNull @Size(min = 2, max = 50) List<UUID> memberIds) {}
}
