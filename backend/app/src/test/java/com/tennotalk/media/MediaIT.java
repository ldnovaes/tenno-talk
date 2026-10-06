package com.tennotalk.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import javax.imageio.ImageIO;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.ResultActions;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MediaIT extends IntegrationTest {

    private UUID rafael;
    private UUID linh;
    private UUID ana;

    @BeforeEach
    void people() {
        rafael = data.user("rafael", "pt-BR");
        linh = data.user("linh", "vi-VN");
        ana = data.user("ana", "es-ES");
    }

    static byte[] image(String format, int width, int height) throws Exception {
        BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        image.setRGB(0, 0, 0x3390EC);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, format, out);
        return out.toByteArray();
    }

    /** A JPEG carrying an EXIF (APP1) segment with a fake GPS position. */
    static byte[] jpegWithExif() throws Exception {
        byte[] jpeg = image("jpg", 8, 8);
        byte[] payload = "Exif\0\0GPSLatitude=-23.5505;SECRET-LOCATION".getBytes(StandardCharsets.ISO_8859_1);
        int length = payload.length + 2;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(jpeg, 0, 2); // SOI
        out.write(new byte[] {(byte) 0xFF, (byte) 0xE1, (byte) (length >> 8), (byte) length});
        out.write(payload);
        out.write(jpeg, 2, jpeg.length - 2);
        return out.toByteArray();
    }

    /** A valid PNG signature and header (IHDR) declaring any size, with no pixel data. */
    static byte[] pngHeader(int width, int height) {
        java.nio.ByteBuffer ihdr = java.nio.ByteBuffer.allocate(17);
        ihdr.put("IHDR".getBytes(StandardCharsets.US_ASCII)).putInt(width).putInt(height)
                .put((byte) 8).put((byte) 2).put((byte) 0).put((byte) 0).put((byte) 0);
        java.util.zip.CRC32 crc = new java.util.zip.CRC32();
        crc.update(ihdr.array());
        java.nio.ByteBuffer png = java.nio.ByteBuffer.allocate(8 + 4 + 17 + 4 + 12);
        png.put(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'});
        png.putInt(13).put(ihdr.array()).putInt((int) crc.getValue());
        png.putInt(0).put("IEND".getBytes(StandardCharsets.US_ASCII)).putInt(0xAE426082);
        return png.array();
    }

    private ResultActions upload(UUID user, String name, String declaredType, byte[] bytes) throws Exception {
        return mvc.perform(multipart("/api/media").file(new MockMultipartFile("file", name, declaredType, bytes)).with(as(user)).with(csrf()));
    }

    private String uploadOk(UUID user, String name, byte[] bytes) throws Exception {
        return api.ok(upload(user, name, "application/octet-stream", bytes)).get("id").asString();
    }

    private ResultActions download(UUID user, String id) throws Exception {
        return mvc.perform(get("/api/media/" + id).with(as(user)));
    }

    // ---- upload validation -------------------------------------------------

    @Test
    void uploadsAnImageWithItsSize() throws Exception {
        JsonNode media = api.ok(upload(rafael, "beach.png", "image/png", image("png", 4, 3)));
        assertThat(media.get("kind").asString()).isEqualTo("image");
        assertThat(media.get("url").asString()).isEqualTo("/api/media/" + media.get("id").asString());
        assertThat(media.get("width").asInt()).isEqualTo(4);
        assertThat(media.get("height").asInt()).isEqualTo(3);
    }

    @Test
    void downloadsRevalidateAccessAfterPrivacyChanges() throws Exception {
        String id = uploadOk(rafael, "a.png", image("png", 2, 2));
        api.postOk(rafael, "/api/posts", Map.of("mediaIds", List.of(id)));
        download(linh, id).andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-cache")));
        data.setPreference(rafael, "profile_visibility", "private");
        download(linh, id).andExpect(status().isNotFound());
    }

    @Test
    void theTypeComesFromTheBytesNotFromTheClient() throws Exception {
        JsonNode media = api.ok(upload(rafael, "photo.bin", "text/plain", image("png", 2, 2)));
        assertThat(media.get("kind").asString()).isEqualTo("image");
        assertThat(media.get("mimeType").asString()).isEqualTo("image/png");
    }

    @Test
    void htmlDisguisedAsAnImageIsRejected() throws Exception {
        byte[] html = "<!DOCTYPE html><html><body><script>alert(1)</script></body></html>".getBytes(StandardCharsets.UTF_8);
        upload(rafael, "cat.png", "image/png", html).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("validation"));
    }

    @Test
    void svgIsRejectedBecauseItCanCarryScripts() throws Exception {
        byte[] svg = "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
                .getBytes(StandardCharsets.UTF_8);
        upload(rafael, "logo.svg", "image/svg+xml", svg).andExpect(status().isBadRequest());
    }

    @Test
    void damagedImagesAreRejectedNotStoredWithTheirMetadata() throws Exception {
        byte[] png = image("png", 4, 4);
        byte[] damaged = java.util.Arrays.copyOf(png, png.length);
        for (int i = 40; i < damaged.length - 12; i++) damaged[i] = (byte) 0x5A;
        upload(rafael, "broken.png", "image/png", damaged)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("validation"));
        assertThat(jdbc.sql("SELECT count(*) FROM media").query(Long.class).single()).isZero();
    }

    @Test
    void decompressionBombsAreRejectedWithoutDecoding() throws Exception {
        upload(rafael, "bomb.png", "image/png", pngHeader(30_000, 30_000))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("validation"));
        assertThat(jdbc.sql("SELECT count(*) FROM media").query(Long.class).single()).isZero();
    }

    @Test
    void photosAboveTheMemoryCeilingAreRejected() throws Exception {
        byte[] png = image("png", 2, 2);
        byte[] huge = java.util.Arrays.copyOf(png, (int) MediaService.MAX_IMAGE_BYTES + 1);
        upload(rafael, "huge.png", "image/png", huge).andExpect(status().isBadRequest());
        assertThat(jdbc.sql("SELECT count(*) FROM media").query(Long.class).single()).isZero();
    }

    @Test
    void emptyFilesAreRejected() throws Exception {
        upload(rafael, "empty.png", "image/png", new byte[0]).andExpect(status().isBadRequest());
    }

    @Test
    void otherFilesAreStoredAsFiles() throws Exception {
        byte[] pdf = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF".getBytes(StandardCharsets.ISO_8859_1);
        JsonNode media = api.ok(upload(rafael, "notes.pdf", "application/pdf", pdf));
        assertThat(media.get("kind").asString()).isEqualTo("file");
        download(rafael, media.get("id").asString())
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")));
    }

    @Test
    void photosLoseTheirExifLocation() throws Exception {
        byte[] original = jpegWithExif();
        assertThat(new String(original, StandardCharsets.ISO_8859_1)).contains("SECRET-LOCATION");
        String id = uploadOk(rafael, "trip.jpg", original);
        byte[] stored = download(rafael, id).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(stored, StandardCharsets.ISO_8859_1)).doesNotContain("SECRET-LOCATION").doesNotContain("Exif");
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(stored)).getWidth()).isEqualTo(8);
    }

    @Test
    void fileNamesCannotEscapeOrInjectHeaders() throws Exception {
        byte[] pdf = "%PDF-1.4\n%%EOF".getBytes(StandardCharsets.ISO_8859_1);
        String id = api.ok(upload(rafael, "../../etc/pass\"wd\r\n.pdf", "application/pdf", pdf)).get("id").asString();
        String disposition = download(rafael, id).andReturn().getResponse().getHeader("Content-Disposition");
        assertThat(disposition).doesNotContain("..").doesNotContain("/").doesNotContain("\r").doesNotContain("\n");
        String path = jdbc.sql("SELECT storage_path FROM media WHERE id = :id").param("id", UUID.fromString(id)).query(String.class).single();
        assertThat(path).doesNotContain("..").endsWith(id + ".bin");
    }

    // ---- downloads ---------------------------------------------------------

    @Test
    void downloadsAreInlineForMediaAndNeverSniffed() throws Exception {
        String id = uploadOk(rafael, "a.png", image("png", 2, 2));
        download(rafael, id)
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("private")));
    }

    @Test
    void rangeRequestsAllowVideoSeeking() throws Exception {
        String id = uploadOk(rafael, "a.png", image("png", 2, 2));
        mvc.perform(get("/api/media/" + id).header("Range", "bytes=0-3").with(as(rafael)))
                .andExpect(status().isPartialContent())
                .andExpect(header().string("Content-Length", "4"));
    }

    @Test
    void strangersCannotDownloadPrivateFiles() throws Exception {
        String id = uploadOk(rafael, "a.png", image("png", 2, 2));
        download(linh, id).andExpect(status().isNotFound());
        download(linh, UUID.randomUUID().toString()).andExpect(status().isNotFound());
        download(linh, "nope").andExpect(status().isNotFound());
    }

    @Test
    void conversationMembersCanDownloadWhatWasSent() throws Exception {
        String id = uploadOk(rafael, "a.png", image("png", 2, 2));
        UUID conversation = steps.direct(rafael, linh);
        api.postOk(rafael, "/api/conversations/" + conversation + "/messages",
                Map.of("clientId", "m-1", "mediaIds", List.of(id)));
        download(linh, id).andExpect(status().isOk());
        download(ana, id).andExpect(status().isNotFound());
    }

    @Test
    void postMediaFollowsThePostsVisibility() throws Exception {
        String id = uploadOk(rafael, "a.png", image("png", 2, 2));
        api.postOk(rafael, "/api/posts", Map.of("mediaIds", List.of(id)));
        download(linh, id).andExpect(status().isOk());

        data.setPreference(rafael, "profile_visibility", "private");
        download(linh, id).andExpect(status().isNotFound());
        data.follow(linh, rafael);
        download(linh, id).andExpect(status().isOk());
        data.block(rafael, linh);
        download(linh, id).andExpect(status().isNotFound());
    }

    @Test
    void storyMediaIsVisibleOnlyWhileTheStoryLives() throws Exception {
        String id = uploadOk(rafael, "a.png", image("png", 2, 2));
        String story = api.postOk(rafael, "/api/stories", Map.of("mediaId", id)).get("id").asString();
        download(linh, id).andExpect(status().isOk());
        jdbc.sql("UPDATE stories SET expires_at = :at WHERE id = :id")
                .param("at", Timestamp.from(Instant.now().minusSeconds(5))).param("id", UUID.fromString(story)).update();
        download(linh, id).andExpect(status().isNotFound());
        download(rafael, id).andExpect(status().isOk());
    }

    @Test
    void privateStoryMediaNeedsAnApprovedFollowEvenWithItsDirectUrl() throws Exception {
        String id = uploadOk(rafael, "private.png", image("png", 2, 2));
        api.postOk(rafael, "/api/stories", Map.of("mediaId", id));
        data.setPreference(rafael, "profile_visibility", "private");

        download(linh, id).andExpect(status().isNotFound());
        api.put(linh, "/api/profiles/" + rafael + "/follow").andExpect(status().isOk());
        download(linh, id).andExpect(status().isNotFound());

        api.post(rafael, "/api/me/follow-requests/" + linh + "/approve", null).andExpect(status().isNoContent());
        download(linh, id).andExpect(status().isOk());
        data.block(rafael, linh);
        download(linh, id).andExpect(status().isNotFound());
    }

    @Test
    void avatarsArePublic() throws Exception {
        String id = uploadOk(rafael, "me.png", image("png", 2, 2));
        jdbc.sql("UPDATE users SET avatar_url = :url WHERE id = :id").param("url", "/api/media/" + id).param("id", rafael).update();
        download(ana, id).andExpect(status().isOk());
    }

    @org.springframework.beans.factory.annotation.Autowired
    MediaStorage storage;

    @Test
    void deletingTheAccountRemovesItsFilesFromDisk() throws Exception {
        String id = uploadOk(rafael, "a.png", image("png", 2, 2));
        String path = jdbc.sql("SELECT storage_path FROM media WHERE id = :id").param("id", UUID.fromString(id)).query(String.class).single();
        assertThat(java.nio.file.Files.exists(storage.resolve(path))).isTrue();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/me").with(as(rafael)).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(java.nio.file.Files.exists(storage.resolve(path))).isFalse();
    }

    @Test
    void uploadingNeedsASessionAndACsrfToken() throws Exception {
        byte[] png = image("png", 2, 2);
        mvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "a.png", "image/png", png)).with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "a.png", "image/png", png)).with(as(rafael)))
                .andExpect(status().isForbidden());
    }
}
