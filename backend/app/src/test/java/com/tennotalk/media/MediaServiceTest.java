package com.tennotalk.media;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

import com.tennotalk.common.ApiException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

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
        byte[] cleaned = MediaService.stripMetadata(MediaIT.jpegWithExif(), "jpg").bytes();
        assertThat(new String(cleaned, StandardCharsets.ISO_8859_1)).doesNotContain("SECRET-LOCATION");
    }

    @Test
    void stripMetadataLeavesUnreadableBytesAlone() throws Exception {
        byte[] garbage = {1, 2, 3};
        assertThat(MediaService.stripMetadata(garbage, "png").bytes()).isEqualTo(garbage);
    }

    @Test
    void blockedTypesIncludeEverythingScriptable() {
        assertThat(MediaService.BLOCKED).contains("text/html", "image/svg+xml", "application/javascript", "application/xhtml+xml");
        assertThat(MediaService.IMAGES).doesNotContain("image/svg+xml");
    }

    @Test
    void aSmallFileDeclaringBillionsOfPixelsIsRefusedBeforeDecoding() {
        // 30000×30000 RGB would need ~3.6 GB of heap; the header alone is a few bytes.
        assertThatThrownBy(() -> MediaService.stripMetadata(MediaIT.pngHeader(30_000, 30_000), "png"))
                .isInstanceOf(ApiException.class).hasMessageContaining("too large");
    }

    @Test
    void sizeLimitsCoverEachSideAndTheTotal() {
        MediaService.requireReasonableSize(4032, 3024);
        MediaService.requireReasonableSize(12_000, 2_000);
        assertThatThrownBy(() -> MediaService.requireReasonableSize(12_001, 10)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> MediaService.requireReasonableSize(10, 12_001)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> MediaService.requireReasonableSize(6_000, 4_001)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> MediaService.requireReasonableSize(0, 10)).isInstanceOf(ApiException.class);
    }
}
