package com.tennotalk.media;

import java.io.IOException;
import java.util.Arrays;

import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

import static org.assertj.core.api.Assertions.assertThat;

/** Untrusted bytes from any client: the metadata strippers either clean or refuse, never crash (PLAN.md §29). */
class ImageMetadataPropertiesTest {

    @Provide
    Arbitrary<byte[]> anyBytes() {
        return Arbitraries.bytes().array(byte[].class).ofMaxSize(512);
    }

    /** Valid headers followed by garbage: the parsers walk into the body before failing. */
    @Provide
    Arbitrary<byte[]> plausibleWebp() {
        return anyBytes().map(tail -> {
            byte[] bytes = Arrays.copyOf("RIFF\0\0\0\0WEBP".getBytes(java.nio.charset.StandardCharsets.US_ASCII), 12 + tail.length);
            System.arraycopy(tail, 0, bytes, 12, tail.length);
            return bytes;
        });
    }

    @Provide
    Arbitrary<byte[]> plausibleGif() {
        return anyBytes().map(tail -> {
            byte[] bytes = Arrays.copyOf("GIF89a".getBytes(java.nio.charset.StandardCharsets.US_ASCII), 6 + tail.length);
            System.arraycopy(tail, 0, bytes, 6, tail.length);
            return bytes;
        });
    }

    private interface Stripper {
        byte[] strip(byte[] bytes) throws IOException;
    }

    private static void cleansOrRefuses(Stripper stripper, byte[] bytes) {
        try {
            byte[] once = stripper.strip(bytes);
            assertThat(stripper.strip(once)).as("idempotent").isEqualTo(once);
        } catch (IOException refused) {
            // refused: never stored
        }
    }

    @Property(tries = 2000)
    void webpNeverCrashes(@ForAll("plausibleWebp") byte[] bytes) {
        cleansOrRefuses(ImageMetadata::stripWebp, bytes);
    }

    @Property(tries = 2000)
    void gifNeverCrashes(@ForAll("plausibleGif") byte[] bytes) {
        cleansOrRefuses(ImageMetadata::stripGif, bytes);
    }

    @Property(tries = 500)
    void randomBytesNeverCrash(@ForAll("anyBytes") byte[] bytes) {
        cleansOrRefuses(ImageMetadata::stripWebp, bytes);
        cleansOrRefuses(ImageMetadata::stripGif, bytes);
    }

    @net.jqwik.api.Example
    void realFilesAreIdempotent() throws Exception {
        byte[] webp = ImageMetadata.stripWebp(MediaFormatsIT.webpWithMetadata());
        assertThat(ImageMetadata.stripWebp(webp)).isEqualTo(webp);
        byte[] gif = ImageMetadata.stripGif(MediaFormatsIT.gifWithMetadata());
        assertThat(ImageMetadata.stripGif(gif)).isEqualTo(gif);
    }
}
