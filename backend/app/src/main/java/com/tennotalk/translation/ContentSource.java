package com.tennotalk.translation;

import java.util.Optional;
import java.util.UUID;

import com.tennotalk.chat.ChatDtos.OriginalTextDto;

/** Feed and stories expose their texts to the translation layer (posts, comments, stories). */
public interface ContentSource {

    /** "post", "comment" or "story". */
    String kind();

    /** The original text, if the viewer may see this content. */
    Optional<OriginalTextDto> originalFor(UUID viewer, UUID contentId);

    /** The original text regardless of viewer (worker side). */
    Optional<OriginalTextDto> original(UUID contentId);
}
