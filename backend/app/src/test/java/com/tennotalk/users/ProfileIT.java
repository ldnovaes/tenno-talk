package com.tennotalk.users;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.tennotalk.support.IntegrationTest;
import com.tennotalk.support.TestData;

import static com.tennotalk.support.TestData.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ProfileIT extends IntegrationTest {

    private UUID newAccount() {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO users (id, email, native_language) VALUES (:id, :e, 'pt-BR')").param("id", id).param("e", id + "@x.com").update();
        jdbc.sql("INSERT INTO user_preferences (user_id, receiving_language) VALUES (:id, 'pt-BR')").param("id", id).update();
        return id;
    }

    private Map<String, Object> onboarding(String username) {
        return Map.of("nativeLanguage", "pt-BR", "receivingLanguage", "en-US", "displayName", " Maria ", "username", username,
                "bio", "", "country", "br");
    }

    @Test
    void onboardingRequiresTheCurrentTerms() throws Exception {
        UUID me = newAccount();
        mvc.perform(withJson(post("/api/me/onboarding"), onboarding("maria")).with(as(me)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/me/terms"), Map.of("version", "2001-01-01")).with(as(me)))
                .andExpect(status().isBadRequest());
        mvc.perform(withJson(post("/api/me/terms"), Map.of("version", TestData.TERMS)).with(as(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.termsAcceptedVersion").value(TestData.TERMS));
        mvc.perform(withJson(post("/api/me/onboarding"), onboarding("@Maria_S")).with(as(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("maria_s"))
                .andExpect(jsonPath("$.displayName").value("Maria"))
                .andExpect(jsonPath("$.country").value("BR"))
                .andExpect(jsonPath("$.bio").isEmpty())
                .andExpect(jsonPath("$.onboardingCompletedAt").isNotEmpty())
                .andExpect(jsonPath("$.preferences.translation.receivingLanguage").value("en-US"));
        String ip = jdbc.sql("SELECT ip FROM terms_acceptances WHERE user_id = :id").param("id", me).query(String.class).single();
        assertThat(ip).isNotBlank();
    }

    @Test
    void usernamesAreValidatedAndUnique() throws Exception {
        data.user("linh", "vi-VN");
        UUID me = newAccount();
        mvc.perform(withJson(post("/api/me/terms"), Map.of("version", TestData.TERMS)).with(as(me))).andExpect(status().isOk());
        mvc.perform(withJson(post("/api/me/onboarding"), onboarding("LINH")).with(as(me)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.fieldErrors.username").value("taken"));
        mvc.perform(withJson(post("/api/me/onboarding"), onboarding("1abc")).with(as(me)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.username").value("format"));
        mvc.perform(get("/api/usernames/linh/availability").with(as(me))).andExpect(jsonPath("$.available").value(false));
        mvc.perform(get("/api/usernames/free_name/availability").with(as(me))).andExpect(jsonPath("$.available").value(true));
        mvc.perform(get("/api/usernames/x/availability").with(as(me))).andExpect(jsonPath("$.available").value(false));
    }

    @Test
    void unsupportedLanguagesAreRejected() throws Exception {
        UUID me = data.user("rafael", "pt-BR");
        mvc.perform(withJson(patch("/api/me/preferences"), Map.of("translation", Map.of("receivingLanguage", "xx-XX"))).with(as(me)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void preferencesArePatchedPartially() throws Exception {
        UUID me = data.user("rafael", "pt-BR");
        mvc.perform(withJson(patch("/api/me/preferences"), Map.of(
                        "translation", Map.of("displayMode", "both", "learningMode", true),
                        "privacy", Map.of("whoCanMessage", "followers"))).with(as(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.translation.displayMode").value("both"))
                .andExpect(jsonPath("$.preferences.translation.learningMode").value(true))
                .andExpect(jsonPath("$.preferences.translation.receivingLanguage").value("pt-BR"))
                .andExpect(jsonPath("$.preferences.privacy.whoCanMessage").value("followers"))
                .andExpect(jsonPath("$.preferences.privacy.whoCanComment").value("everyone"));
        mvc.perform(withJson(patch("/api/me/preferences"), Map.of("translation", Map.of("displayMode", "weird"))).with(as(me)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.displayMode").exists());
    }

    @Test
    void updatesTheProfileWithoutTheNativeLanguageAmongLearning() throws Exception {
        UUID me = data.user("rafael", "pt-BR");
        mvc.perform(withJson(put("/api/me/profile"), Map.of("displayName", "Rafael A.", "username", "rafael.a", "bio", "Oi",
                        "country", "PT", "nativeLanguage", "pt-BR", "learningLanguages", List.of("vi-VN", "pt-PT", "vi-VN"))).with(as(me)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("rafael.a"))
                .andExpect(jsonPath("$.learningLanguages", contains("vi-VN")));
    }

    private org.springframework.test.web.servlet.ResultActions setAvatar(UUID me, String avatarUrl) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>(Map.of("displayName", "Rafael", "username", "rafael", "country", "BR",
                "nativeLanguage", "pt-BR", "learningLanguages", List.of()));
        body.put("avatarUrl", avatarUrl);
        return mvc.perform(withJson(put("/api/me/profile"), body).with(as(me)));
    }

    @Test
    void avatarsMustBeYourOwnUploadedPhoto() throws Exception {
        UUID me = data.user("rafael", "pt-BR");
        UUID other = data.user("linh", "vi-VN");
        UUID mine = data.media(me, "image");
        setAvatar(me, "/api/media/" + mine).andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").value("/api/media/" + mine));

        // Someone else's (private) photo would become public through the avatar rule.
        setAvatar(me, "/api/media/" + data.media(other, "image"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.avatarUrl").exists());
        setAvatar(me, "/api/media/" + data.media(me, "file")).andExpect(status().isBadRequest());
        setAvatar(me, "https://tracker.example.com/pixel.png").andExpect(status().isBadRequest());
        setAvatar(me, "javascript:alert(1)").andExpect(status().isBadRequest());
        setAvatar(me, "/api/media/------------------------------------").andExpect(status().isBadRequest());
        setAvatar(me, "/api/media/" + mine + "/../x").andExpect(status().isBadRequest());

        setAvatar(me, null).andExpect(status().isOk()).andExpect(jsonPath("$.avatarUrl").doesNotExist());
    }

    @Test
    void profilesShowCountsAndFollowState() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        UUID linh = data.user("linh", "vi-VN");
        UUID minh = data.user("minh", "vi-VN");
        data.follow(minh, linh);
        mvc.perform(put("/api/profiles/" + linh + "/follow").with(as(rafael)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isFollowing").value(true))
                .andExpect(jsonPath("$.followersCount").value(2));
        mvc.perform(put("/api/profiles/" + linh + "/follow").with(as(rafael)).with(csrf()))
                .andExpect(jsonPath("$.followersCount").value(2));
        mvc.perform(get("/api/profiles/LINH").with(as(rafael)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nativeLanguage").value("vi-VN"))
                .andExpect(jsonPath("$.isOnline").value(false));
        mvc.perform(delete("/api/profiles/" + linh + "/follow").with(as(rafael)).with(csrf()))
                .andExpect(jsonPath("$.isFollowing").value(false))
                .andExpect(jsonPath("$.followersCount").value(1));
        mvc.perform(put("/api/profiles/" + rafael + "/follow").with(as(rafael)).with(csrf())).andExpect(status().isBadRequest());
        mvc.perform(get("/api/profiles/nobody").with(as(rafael))).andExpect(status().isNotFound());
        mvc.perform(get("/api/profiles/" + "x").with(as(rafael))).andExpect(status().isNotFound());
    }

    @Test
    void privateProfilesRequireApprovalAndBlockingSilentlyCancelsRequests() throws Exception {
        UUID owner = data.user("privateowner", "pt-BR");
        UUID requester = data.user("requester", "vi-VN");
        UUID second = data.user("second", "en-US");
        data.setPreference(owner, "profile_visibility", "private");
        mvc.perform(put("/api/profiles/" + owner + "/follow").with(as(requester)).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.isPrivate").value(true))
                .andExpect(jsonPath("$.isFollowing").value(false))
                .andExpect(jsonPath("$.followRequestPending").value(true))
                .andExpect(jsonPath("$.followersCount").value(0));
        mvc.perform(get("/api/me/follow-requests").with(as(owner)))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].username").value("requester"));
        mvc.perform(post("/api/me/follow-requests/" + requester + "/approve").with(as(second)).with(csrf()))
                .andExpect(status().isNotFound());
        mvc.perform(post("/api/me/follow-requests/" + requester + "/approve").with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/profiles/privateowner").with(as(requester)))
                .andExpect(jsonPath("$.isFollowing").value(true))
                .andExpect(jsonPath("$.followRequestPending").value(false));
        mvc.perform(put("/api/profiles/" + owner + "/follow").with(as(second)).with(csrf()))
                .andExpect(jsonPath("$.followRequestPending").value(true));
        mvc.perform(put("/api/profiles/" + second + "/block").with(as(owner)).with(csrf()))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/me/follow-requests").with(as(owner))).andExpect(jsonPath("$", hasSize(0)));
        assertThat(jdbc.sql("SELECT count(*) FROM follow_requests").query(Long.class).single()).isZero();
    }

    @Test
    void makingAProfilePublicResolvesPendingFollowRequests() throws Exception {
        UUID owner = data.user("privateowner", "pt-BR");
        UUID requester = data.user("requester", "vi-VN");
        data.setPreference(owner, "profile_visibility", "private");
        mvc.perform(put("/api/profiles/" + owner + "/follow").with(as(requester)).with(csrf()))
                .andExpect(jsonPath("$.followRequestPending").value(true));

        mvc.perform(withJson(patch("/api/me/preferences"), Map.of("privacy", Map.of("profileVisibility", "public"))).with(as(owner)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.privacy.profileVisibility").value("public"));
        mvc.perform(get("/api/profiles/privateowner").with(as(requester)))
                .andExpect(jsonPath("$.isFollowing").value(true))
                .andExpect(jsonPath("$.followRequestPending").value(false));
        assertThat(jdbc.sql("SELECT count(*) FROM follow_requests").query(Long.class).single()).isZero();
    }

    @Test
    void blockingMarksProfilesBothWaysAndRemovesFollows() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        UUID linh = data.user("linh", "vi-VN");
        data.follow(rafael, linh);
        data.follow(linh, rafael);
        mvc.perform(put("/api/profiles/" + linh + "/block").with(as(rafael)).with(csrf())).andExpect(status().isNoContent());
        assertThat(jdbc.sql("SELECT count(*) FROM follows").query(Long.class).single()).isZero();
        mvc.perform(get("/api/profiles/linh").with(as(rafael)))
                .andExpect(jsonPath("$.blockStatus").value("blocked_by_me")).andExpect(jsonPath("$.lastSeenAt").isEmpty());
        mvc.perform(get("/api/profiles/rafael").with(as(linh)))
                .andExpect(jsonPath("$.blockStatus").value("blocked_me")).andExpect(jsonPath("$.postsCount").value(0));
        mvc.perform(put("/api/profiles/" + rafael + "/follow").with(as(linh)).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(get("/api/me/blocked").with(as(rafael))).andExpect(jsonPath("$[0].username").value("linh"));
        mvc.perform(delete("/api/profiles/" + linh + "/block").with(as(rafael)).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(get("/api/me/blocked").with(as(rafael))).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(put("/api/profiles/" + rafael + "/block").with(as(rafael)).with(csrf())).andExpect(status().isBadRequest());
    }

    @Test
    void searchAndSuggestionsSkipTheViewerAndBlockedPeople() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        data.user("linh", "vi-VN");
        UUID omar = data.user("omar", "ar");
        data.block(rafael, omar);
        mvc.perform(get("/api/people/search").param("q", "@LI").with(as(rafael)))
                .andExpect(jsonPath("$[*].username", contains("linh")));
        mvc.perform(get("/api/people/suggestions").with(as(rafael)))
                .andExpect(jsonPath("$[*].username", contains("linh")));
    }

    @Test
    void deletingTheAccountRemovesTheUserAndSignsOut() throws Exception {
        UUID rafael = data.user("rafael", "pt-BR");
        UUID linh = data.user("linh", "vi-VN");
        data.follow(linh, rafael);
        mvc.perform(delete("/api/me").with(as(rafael)).with(csrf())).andExpect(status().isNoContent());
        assertThat(jdbc.sql("SELECT count(*) FROM users WHERE id = :id").param("id", rafael).query(Long.class).single()).isZero();
        mvc.perform(get("/api/profiles/linh").with(as(linh))).andExpect(jsonPath("$.followingCount").value(0));
        mvc.perform(get("/api/me").with(as(rafael))).andExpect(status().isUnauthorized());
    }
}
