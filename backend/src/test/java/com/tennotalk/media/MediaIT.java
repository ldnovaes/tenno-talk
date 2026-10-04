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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MediaIT extends IntegrationTest {

    private UUID lucas;
    private UUID cam;
    private UUID ana;

    @BeforeEach
    void people() {
        lucas = data.user("lucas", "pt-BR");
        cam = data.user("cam", "vi-VN");
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
        JsonNode media = api.ok(upload(lucas, "beach.png", "image/png", image("png", 4, 3)));
        assertThat(media.get("kind").asString()).isEqualTo("image");
        assertThat(media.get("url").asString()).isEqualTo("/api/media/" + media.get("id").asString());
        assertThat(media.get("width").asInt()).isEqualTo(4);
        assertThat(media.get("height").asInt()).isEqualTo(3);
    }

    @Test
    void theTypeComesFromTheBytesNotFromTheClient() throws Exception {
        JsonNode media = api.ok(upload(lucas, "photo.bin", "text/plain", image("png", 2, 2)));
        assertThat(media.get("kind").asString()).isEqualTo("image");
        assertThat(media.get("mimeType").asString()).isEqualTo("image/png");
    }

    @Test
    void htmlDisguisedAsAnImageIsRejected() throws Exception {
        byte[] html = "<!DOCTYPE html><html><body><script>alert(1)</script></body></html>".getBytes(StandardCharsets.UTF_8);
        upload(lucas, "cat.png", "image/png", html).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("validation"));
    }

    @Test
    void svgIsRejectedBecauseItCanCarryScripts() throws Exception {
        byte[] svg = "<?xml version=\"1.0\"?><svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"
                .getBytes(StandardCharsets.UTF_8);
        upload(lucas, "logo.svg", "image/svg+xml", svg).andExpect(status().isBadRequest());
    }

    @Test
    void damagedImagesAreRejectedNotStoredWithTheirMetadata() throws Exception {
        byte[] png = image("png", 4, 4);
        byte[] damaged = java.util.Arrays.copyOf(png, png.length);
        for (int i = 40; i < damaged.length - 12; i++) damaged[i] = (byte) 0x5A;
        upload(lucas, "broken.png", "image/png", damaged)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("validation"));
        assertThat(jdbc.sql("SELECT count(*) FROM media").query(Long.class).single()).isZero();
    }

    @Test
    void emptyFilesAreRejected() throws Exception {
        upload(lucas, "empty.png", "image/png", new byte[0]).andExpect(status().isBadRequest());
    }

    @Test
    void otherFilesAreStoredAsFiles() throws Exception {
        byte[] pdf = "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF".getBytes(StandardCharsets.ISO_8859_1);
        JsonNode media = api.ok(upload(lucas, "notes.pdf", "application/pdf", pdf));
        assertThat(media.get("kind").asString()).isEqualTo("file");
        download(lucas, media.get("id").asString())
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")));
    }

    @Test
    void photosLoseTheirExifLocation() throws Exception {
        byte[] original = jpegWithExif();
        assertThat(new String(original, StandardCharsets.ISO_8859_1)).contains("SECRET-LOCATION");
        String id = uploadOk(lucas, "trip.jpg", original);
        byte[] stored = download(lucas, id).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(stored, StandardCharsets.ISO_8859_1)).doesNotContain("SECRET-LOCATION").doesNotContain("Exif");
        assertThat(ImageIO.read(new java.io.ByteArrayInputStream(stored)).getWidth()).isEqualTo(8);
    }

    @Test
    void fileNamesCannotEscapeOrInjectHeaders() throws Exception {
        byte[] pdf = "%PDF-1.4\n%%EOF".getBytes(StandardCharsets.ISO_8859_1);
        String id = api.ok(upload(lucas, "../../etc/pass\"wd\r\n.pdf", "application/pdf", pdf)).get("id").asString();
        String disposition = download(lucas, id).andReturn().getResponse().getHeader("Content-Disposition");
        assertThat(disposition).doesNotContain("..").doesNotContain("/").doesNotContain("\r").doesNotContain("\n");
        String path = jdbc.sql("SELECT storage_path FROM media WHERE id = :id").param("id", UUID.fromString(id)).query(String.class).single();
        assertThat(path).doesNotContain("..").endsWith(id + ".bin");
    }

    // ---- downloads ---------------------------------------------------------

    @Test
    void downloadsAreInlineForMediaAndNeverSniffed() throws Exception {
        String id = uploadOk(lucas, "a.png", image("png", 2, 2));
        download(lucas, id)
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("inline")))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("private")));
    }

    @Test
    void rangeRequestsAllowVideoSeeking() throws Exception {
        String id = uploadOk(lucas, "a.png", image("png", 2, 2));
        mvc.perform(get("/api/media/" + id).header("Range", "bytes=0-3").with(as(lucas)))
                .andExpect(status().isPartialContent())
                .andExpect(header().string("Content-Length", "4"));
    }

    @Test
    void strangersCannotDownloadPrivateFiles() throws Exception {
        String id = uploadOk(lucas, "a.png", image("png", 2, 2));
        download(cam, id).andExpect(status().isNotFound());
        download(cam, UUID.randomUUID().toString()).andExpect(status().isNotFound());
        download(cam, "nope").andExpect(status().isNotFound());
    }

    @Test
    void conversationMembersCanDownloadWhatWasSent() throws Exception {
        String id = uploadOk(lucas, "a.png", image("png", 2, 2));
        UUID conversation = steps.direct(lucas, cam);
        api.postOk(lucas, "/api/conversations/" + conversation + "/messages",
                Map.of("clientId", "m-1", "mediaIds", List.of(id)));
        download(cam, id).andExpect(status().isOk());
        download(ana, id).andExpect(status().isNotFound());
    }

    @Test
    void postMediaFollowsThePostsVisibility() throws Exception {
        String id = uploadOk(lucas, "a.png", image("png", 2, 2));
        api.postOk(lucas, "/api/posts", Map.of("mediaIds", List.of(id)));
        download(cam, id).andExpect(status().isOk());

        data.setPreference(lucas, "profile_visibility", "private");
        download(cam, id).andExpect(status().isNotFound());
        data.follow(cam, lucas);
        download(cam, id).andExpect(status().isOk());
        data.block(lucas, cam);
        download(cam, id).andExpect(status().isNotFound());
    }

    @Test
    void storyMediaIsVisibleOnlyWhileTheStoryLives() throws Exception {
        String id = uploadOk(lucas, "a.png", image("png", 2, 2));
        String story = api.postOk(lucas, "/api/stories", Map.of("mediaId", id)).get("id").asString();
        download(cam, id).andExpect(status().isOk());
        jdbc.sql("UPDATE stories SET expires_at = :at WHERE id = :id")
                .param("at", Timestamp.from(Instant.now().minusSeconds(5))).param("id", UUID.fromString(story)).update();
        download(cam, id).andExpect(status().isNotFound());
        download(lucas, id).andExpect(status().isOk());
    }

    @Test
    void avatarsArePublic() throws Exception {
        String id = uploadOk(lucas, "me.png", image("png", 2, 2));
        jdbc.sql("UPDATE users SET avatar_url = :url WHERE id = :id").param("url", "/api/media/" + id).param("id", lucas).update();
        download(ana, id).andExpect(status().isOk());
    }

    @org.springframework.beans.factory.annotation.Autowired
    MediaStorage storage;

    @Test
    void deletingTheAccountRemovesItsFilesFromDisk() throws Exception {
        String id = uploadOk(lucas, "a.png", image("png", 2, 2));
        String path = jdbc.sql("SELECT storage_path FROM media WHERE id = :id").param("id", UUID.fromString(id)).query(String.class).single();
        assertThat(java.nio.file.Files.exists(storage.resolve(path))).isTrue();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/me").with(as(lucas)).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(java.nio.file.Files.exists(storage.resolve(path))).isFalse();
    }

    @Test
    void uploadingNeedsASessionAndACsrfToken() throws Exception {
        byte[] png = image("png", 2, 2);
        mvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "a.png", "image/png", png)).with(csrf()))
                .andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/media").file(new MockMultipartFile("file", "a.png", "image/png", png)).with(as(lucas)))
                .andExpect(status().isForbidden());
    }
}
