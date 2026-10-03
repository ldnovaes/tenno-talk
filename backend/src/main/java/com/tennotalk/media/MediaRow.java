package com.tennotalk.media;

import java.time.Instant;
import java.util.UUID;

import com.tennotalk.chat.ChatDtos.MediaAttachmentDto;

public record MediaRow(
        UUID id,
        UUID ownerId,
        String kind,
        String mimeType,
        long sizeBytes,
        Integer width,
        Integer height,
        Integer durationMs,
        String storagePath,
        String originalName,
        Instant createdAt) {

    public String url() {
        return "/api/media/" + id;
    }

    public MediaAttachmentDto toDto() {
        return new MediaAttachmentDto(id, kind, url(), "image".equals(kind) ? url() : null, width, height, durationMs,
                mimeType, sizeBytes, null);
    }
}
