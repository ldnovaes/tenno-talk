package com.tennotalk.media;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MediaServiceTest {

    @Test
    void sanitizeKeepsOnlyTheBaseName() {
        assertThat(MediaService.sanitize("../../etc/passwd")).isEqualTo("passwd");
        assertThat(MediaService.sanitize("/abs/path/photo.jpg")).isEqualTo("photo.jpg");
    }

    @Test
    void sanitizeReplacesControlAndQuoteCharacters() {
        assertThat(MediaService.sanitize("a\"b\r\n.pdf")).isEqualTo("a_b__.pdf");
        assertThat(MediaService.sanitize("ảnh đẹp.jpg")).isEqualTo("ảnh đẹp.jpg");
    }

    @Test
    void sanitizeFallsBackToAName() {
        assertThat(MediaService.sanitize(null)).isEqualTo("file");
        assertThat(MediaService.sanitize("   ")).isEqualTo("file");
    }

    @Test
    void sanitizeKeepsTheEndOfLongNames() {
        String name = "a".repeat(200) + ".jpg";
        assertThat(MediaService.sanitize(name)).hasSize(120).endsWith(".jpg");
    }

    @Test
    void stripMetadataRemovesExif() throws Exception {
        byte[] cleaned = MediaService.stripMetadata(MediaIT.jpegWithExif(), "jpg");
        assertThat(new String(cleaned, StandardCharsets.ISO_8859_1)).doesNotContain("SECRET-LOCATION");
    }

    @Test
    void stripMetadataLeavesUnreadableBytesAlone() throws Exception {
        byte[] garbage = {1, 2, 3};
        assertThat(MediaService.stripMetadata(garbage, "png")).isEqualTo(garbage);
    }

    @Test
    void blockedTypesIncludeEverythingScriptable() {
        assertThat(MediaService.BLOCKED).contains("text/html", "image/svg+xml", "application/javascript", "application/xhtml+xml");
        assertThat(MediaService.IMAGES).doesNotContain("image/svg+xml");
    }
}
