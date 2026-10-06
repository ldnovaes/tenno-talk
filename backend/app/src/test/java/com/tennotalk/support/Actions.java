package com.tennotalk.support;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;

import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * What people do in the app, through the API, for tests that need "something happened" rather than how
 * (PLAN.md §23.1): one place that knows which action produces each notification type.
 */
public record Actions(Api api, ChatSteps steps, TestData data, JdbcClient jdbc) {

    public static final List<String> NOTIFICATION_TYPES =
            List.of("like", "comment", "follow", "follow_request", "follow_accepted", "story_reaction", "new_message");

    /** A real photo uploaded through the API (stored on disk, unlike {@link TestData#media}). */
    public UUID upload(UUID owner) throws Exception {
        java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var bytes = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", bytes);
        var file = new org.springframework.mock.web.MockMultipartFile("file", "photo.png", "image/png", bytes.toByteArray());
        var result = api.mvc().perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/media")
                .file(file).with(TestData.as(owner))
                .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()));
        return UUID.fromString(api.ok(result).get("id").asString());
    }

    public String post(UUID author) throws Exception {
        return api.postOk(author, "/api/posts", Map.of("mediaIds", List.of(data.media(author, "image")))).get("id").asString();
    }

    public String story(UUID author) throws Exception {
        return api.postOk(author, "/api/stories", Map.of("mediaId", data.media(author, "image"))).get("id").asString();
    }

    /** {@code actor} does what notifies {@code recipient} with {@code type}; returns the newest such notification, if any. */
    public java.util.Optional<UUID> notify(UUID actor, UUID recipient, String type) throws Exception {
        switch (type) {
            case "like" -> api.put(actor, "/api/posts/" + post(recipient) + "/like").andExpect(status().is2xxSuccessful());
            case "comment" -> api.post(actor, "/api/posts/" + post(recipient) + "/comments", Map.of("text", "Lindo!"))
                    .andExpect(status().is2xxSuccessful());
            case "follow" -> api.put(actor, "/api/profiles/" + recipient + "/follow").andExpect(status().is2xxSuccessful());
            case "follow_request" -> {
                data.setPreference(recipient, "profile_visibility", "private");
                api.put(actor, "/api/profiles/" + recipient + "/follow").andExpect(status().is2xxSuccessful());
            }
            case "follow_accepted" -> {
                data.setPreference(actor, "profile_visibility", "private");
                api.put(recipient, "/api/profiles/" + actor + "/follow").andExpect(status().is2xxSuccessful());
                api.post(actor, "/api/me/follow-requests/" + recipient + "/approve", null).andExpect(status().is2xxSuccessful());
            }
            case "story_reaction" -> api.post(actor, "/api/stories/" + story(recipient) + "/reactions", Map.of("emoji", "🔥"))
                    .andExpect(status().is2xxSuccessful());
            case "new_message" -> steps.send(actor, steps.direct(actor, recipient), "Oi!");
            default -> throw new IllegalArgumentException(type);
        }
        return jdbc.sql("SELECT id FROM notifications WHERE recipient_id = :u AND type = :t ORDER BY created_at DESC LIMIT 1")
                .param("u", recipient).param("t", type).query(UUID.class).optional();
    }

    /** The preference column that turns a notification type off (NotificationService.PREFERENCE). */
    public static String preferenceOf(String type) {
        return switch (type) {
            case "like", "story_reaction" -> "notify_likes";
            case "comment" -> "notify_comments";
            case "follow", "follow_request", "follow_accepted" -> "notify_followers";
            case "new_message" -> "notify_messages";
            default -> throw new IllegalArgumentException(type);
        };
    }
}
