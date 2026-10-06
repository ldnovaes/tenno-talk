package com.tennotalk.media;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Every image format the app accepts leaves no location or device metadata behind (PLAN.md §29): JPEG and PNG are
 * re-encoded, WebP and GIF lose their metadata blocks, and HEIC/HEIF (which the server can't clean) is refused.
 * Videos, audio and other files keep their kind.
 */
class MediaFormatsIT extends IntegrationTest {

    private static final String GPS = "GPSLatitude=-22.9068;GPSLongitude=-43.1729";

    @Value("${tenno.media.root}")
    String mediaRoot;

    private UUID rafael;

    @BeforeEach
    void person() {
        rafael = data.user("rafael", "pt-BR");
    }

    private ResultActions upload(String name, String type, byte[] bytes) throws Exception {
        return mvc.perform(multipart("/api/media").file(new MockMultipartFile("file", name, type, bytes)).with(as(rafael)).with(csrf()));
    }

    private byte[] stored(JsonNode media) throws Exception {
        String path = jdbc.sql("SELECT storage_path FROM media WHERE id = :id")
                .param("id", UUID.fromString(media.get("id").asString())).query(String.class).single();
        return Files.readAllBytes(Path.of(mediaRoot).resolve(path));
    }

    private static boolean contains(byte[] haystack, String needle) {
        return new String(haystack, StandardCharsets.ISO_8859_1).contains(needle);
    }

    // ---- WebP: RIFF chunks, with EXIF and XMP chunks flagged in VP8X ----

    private static byte[] chunk(String fourcc, byte[] payload) {
        ByteBuffer buffer = ByteBuffer.allocate(8 + payload.length + (payload.length % 2)).order(ByteOrder.LITTLE_ENDIAN);
        buffer.put(fourcc.getBytes(StandardCharsets.US_ASCII)).putInt(payload.length).put(payload);
        return buffer.array();
    }

    static byte[] webpWithMetadata() throws Exception {
        byte[] vp8x = new byte[10];
        vp8x[0] = 0x0C; // EXIF (0x08) and XMP (0x04) present
        byte[] image = new byte[] {0x2F, 0x00, 0x00, 0x00, 0x00, (byte) 0x88, (byte) 0x88, 0x08}; // VP8L header bytes
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        body.write("WEBP".getBytes(StandardCharsets.US_ASCII));
        body.write(chunk("VP8X", vp8x));
        body.write(chunk("VP8L", image));
        body.write(chunk("EXIF", ("Exif\0\0" + GPS).getBytes(StandardCharsets.US_ASCII)));
        body.write(chunk("XMP ", ("<x:xmpmeta>" + GPS + "</x:xmpmeta>").getBytes(StandardCharsets.US_ASCII)));
        byte[] content = body.toByteArray();
        ByteBuffer riff = ByteBuffer.allocate(8 + content.length).order(ByteOrder.LITTLE_ENDIAN);
        riff.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(content.length).put(content);
        return riff.array();
    }

    @Test
    void aWebpLosesItsExifAndXmpButStaysAWebp() throws Exception {
        JsonNode media = api.ok(upload("photo.webp", "image/webp", webpWithMetadata()));
        assertThat(media.get("mimeType").asString()).isEqualTo("image/webp");
        byte[] bytes = stored(media);
        assertThat(contains(bytes, "GPSLatitude")).isFalse();
        assertThat(contains(bytes, "EXIF")).isFalse();
        assertThat(contains(bytes, "XMP ")).isFalse();
        assertThat(contains(bytes, "VP8L")).as("the picture itself is kept").isTrue();
        ByteBuffer header = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        assertThat(header.getInt(4)).as("RIFF size matches the new content").isEqualTo(bytes.length - 8);
        assertThat(bytes[20] & 0x0C).as("VP8X no longer announces metadata").isZero();
        assertThat(media.get("sizeBytes").asLong()).isEqualTo(bytes.length);
    }

    // ---- GIF: comment and application extensions (XMP), keeping the animation loop ----

    static byte[] gifWithMetadata() throws Exception {
        java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_BYTE_INDEXED);
        ByteArrayOutputStream plain = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "gif", plain);
        byte[] gif = plain.toByteArray();
        int flags = gif[10] & 0xFF;
        int afterHeader = 13 + ((flags & 0x80) != 0 ? 3 * (1 << ((flags & 0x07) + 1)) : 0);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(gif, 0, afterHeader);
        out.write(new byte[] {0x21, (byte) 0xFF, 0x0B});
        out.write("NETSCAPE2.0".getBytes(StandardCharsets.US_ASCII));
        out.write(new byte[] {0x03, 0x01, 0x00, 0x00, 0x00});
        out.write(new byte[] {0x21, (byte) 0xFF, 0x0B});
        out.write("XMP DataXMP".getBytes(StandardCharsets.US_ASCII));
        byte[] xmp = GPS.getBytes(StandardCharsets.US_ASCII);
        out.write(xmp.length);
        out.write(xmp);
        out.write(0x00);
        out.write(new byte[] {0x21, (byte) 0xFE});
        out.write(xmp.length);
        out.write(xmp);
        out.write(0x00);
        out.write(gif, afterHeader, gif.length - afterHeader);
        return out.toByteArray();
    }

    @Test
    void aGifLosesCommentsAndXmpButKeepsItsLoop() throws Exception {
        JsonNode media = api.ok(upload("party.gif", "image/gif", gifWithMetadata()));
        byte[] bytes = stored(media);
        assertThat(contains(bytes, "GPSLatitude")).isFalse();
        assertThat(contains(bytes, "XMP DataXMP")).isFalse();
        assertThat(contains(bytes, "NETSCAPE2.0")).as("animation loop kept").isTrue();
        assertThat(javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(bytes))).as("still a valid GIF").isNotNull();
    }

    // ---- HEIC/HEIF: the server can't remove their metadata, so they are refused ----

    @ParameterizedTest(name = "{0}")
    @CsvSource({"heic, image/heic", "mif1, image/heif"})
    void aPhotoTheServerCantCleanIsRefused(String brand, String type) throws Exception {
        ByteBuffer box = ByteBuffer.allocate(24);
        box.putInt(24).put("ftyp".getBytes(StandardCharsets.US_ASCII)).put(brand.getBytes(StandardCharsets.US_ASCII)).putInt(0)
                .put(brand.getBytes(StandardCharsets.US_ASCII)).put("heic".getBytes(StandardCharsets.US_ASCII));
        byte[] bytes = new byte[1024];
        System.arraycopy(box.array(), 0, bytes, 0, 24);
        System.arraycopy(GPS.getBytes(StandardCharsets.US_ASCII), 0, bytes, 100, GPS.length());
        upload("IMG_0001.HEIC", type, bytes).andExpect(status().isBadRequest());
        assertThat(jdbc.sql("SELECT count(*) FROM media").query(Long.class).single()).isZero();
    }

    // ---- Kinds of everything else ----

    @ParameterizedTest(name = "{0}")
    @CsvSource({
            "clip.mp4,  000000186674797069736F6D, video",
            "song.mp3,  4944330300000000000F, audio",
            "notes.txt, 48656C6C6F2C206D756E646F, file",
    })
    void videosAudioAndFilesKeepTheirKind(String name, String hexStart, String kind) throws Exception {
        byte[] start = java.util.HexFormat.of().parseHex(hexStart);
        byte[] bytes = new byte[256];
        System.arraycopy(start, 0, bytes, 0, start.length);
        if (kind.equals("file")) bytes = java.util.Arrays.copyOf(start, start.length);
        JsonNode media = api.ok(upload(name, "application/octet-stream", bytes));
        assertThat(media.get("kind").asString()).isEqualTo(kind);
    }

    @Test
    void aFileMissingFromTheDiskIsNotFoundNotAServerError() throws Exception {
        UUID orphan = data.media(rafael, "image");
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/media/" + orphan).with(as(rafael)))
                .andExpect(status().isNotFound());
    }
}
