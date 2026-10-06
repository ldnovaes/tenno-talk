package com.tennotalk.users;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tennotalk.common.ApiException;
import com.tennotalk.common.Languages;
import com.tennotalk.common.PageDto;
import com.tennotalk.common.Presence;
import com.tennotalk.common.Usernames;
import com.tennotalk.config.TennoProperties;
import com.tennotalk.media.MediaStorage;
import com.tennotalk.users.ProfileInputs.CompleteOnboarding;
import com.tennotalk.users.ProfileInputs.PreferencesPatch;
import com.tennotalk.users.ProfileInputs.UpdateProfile;
import com.tennotalk.users.UserDtos.CurrentUserDto;
import com.tennotalk.users.UserDtos.UserProfileDto;

@Service
public class ProfileService {

    private static final Set<String> MODES = Set.of("translation", "both", "original");
    private static final Set<String> AUDIENCES = Set.of("everyone", "followers", "nobody");
    private static final Set<String> VISIBILITY = Set.of("public", "private");

    private final UserRepository users;
    private final PreferencesRepository preferences;
    private final SocialGraph graph;
    private final ProfileQueries profiles;
    private final Presence presence;
    private final TennoProperties properties;
    private final MediaStorage storage;
    private final JdbcClient jdbc;
    private final Clock clock;
    private final com.tennotalk.notifications.NotificationService notifications;
    private final ApplicationEventPublisher events;

    public ProfileService(UserRepository users, PreferencesRepository preferences, SocialGraph graph,
            ProfileQueries profiles, Presence presence, TennoProperties properties, MediaStorage storage,
            JdbcClient jdbc, Clock clock, com.tennotalk.notifications.NotificationService notifications,
            ApplicationEventPublisher events) {
        this.notifications = notifications;
        this.events = events;
        this.users = users;
        this.preferences = preferences;
        this.graph = graph;
        this.profiles = profiles;
        this.presence = presence;
        this.properties = properties;
        this.storage = storage;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CurrentUserDto me(UUID viewer) {
        UserRow user = users.require(viewer);
        UserProfileDto profile = profiles.byId(viewer, viewer).orElseThrow();
        return new CurrentUserDto(
                user.id(),
                profile.username(),
                user.displayName(),
                user.avatarUrl(),
                user.bio(),
                user.country(),
                user.nativeLanguage(),
                user.learningLanguages(),
                profile.followersCount(),
                profile.followingCount(),
                profile.postsCount(),
                false,
                profile.isPrivate(),
                false,
                presence.isOnline(viewer),
                user.lastSeenAt(),
                "none",
                user.email(),
                user.role(),
                users.providers(viewer, user.passwordHash() != null),
                users.latestTermsVersion(viewer).orElse(null),
                user.onboardingCompletedAt(),
                preferences.find(viewer));
    }

    @Transactional
    public CurrentUserDto acceptTerms(UUID viewer, String version, String ip, String userAgent) {
        if (!properties.termsVersion().equals(version)) {
            throw ApiException.validation("Accept the current version of the Terms of Use.");
        }
        users.acceptTerms(viewer, version, ip, userAgent);
        return me(viewer);
    }

    @Transactional(readOnly = true)
    public boolean usernameAvailable(UUID viewer, String username) {
        if (Usernames.problem(username).isPresent()) return false;
        return users.findByUsername(Usernames.normalize(username)).map(user -> user.id().equals(viewer)).orElse(true);
    }

    @Transactional
    public CurrentUserDto completeOnboarding(UUID viewer, CompleteOnboarding input) {
        if (!properties.termsVersion().equals(users.latestTermsVersion(viewer).orElse(null))) {
            throw ApiException.validation("Accept the Terms of Use to continue.");
        }
        requireLanguage(input.nativeLanguage());
        requireLanguage(input.receivingLanguage());
        String username = checkedUsername(viewer, input.username());
        users.updateProfile(viewer, input.displayName().trim(), username, blankToNull(input.bio()),
                input.country().toUpperCase(), checkedAvatar(viewer, input.avatarUrl()), input.nativeLanguage(), List.of());
        Preferences current = preferences.find(viewer);
        preferences.save(viewer, withReceiving(current, input.receivingLanguage()));
        recordReceivingChange(viewer, current, input.receivingLanguage());
        users.completeOnboarding(viewer, clock.instant());
        return me(viewer);
    }

    @Transactional
    public CurrentUserDto updateProfile(UUID viewer, UpdateProfile input) {
        requireLanguage(input.nativeLanguage());
        input.learningLanguages().forEach(ProfileService::requireLanguage);
        String username = checkedUsername(viewer, input.username());
        List<String> learning = input.learningLanguages().stream()
                .filter(code -> !Languages.same(code, input.nativeLanguage()))
                .distinct()
                .toList();
        users.updateProfile(viewer, input.displayName().trim(), username, blankToNull(input.bio()),
                input.country().toUpperCase(), checkedAvatar(viewer, input.avatarUrl()), input.nativeLanguage(), learning);
        return me(viewer);
    }

    @Transactional
    public CurrentUserDto updatePreferences(UUID viewer, PreferencesPatch patch) {
        Preferences current = preferences.find(viewer);
        Preferences.Translation t = current.translation();
        Preferences.Privacy p = current.privacy();
        Preferences.Notifications n = current.notifications();
        if (patch.translation() != null) {
            var tp = patch.translation();
            if (tp.receivingLanguage() != null) requireLanguage(tp.receivingLanguage());
            if (tp.displayMode() != null) requireOneOf(MODES, tp.displayMode(), "displayMode");
            t = new Preferences.Translation(
                    Objects.requireNonNullElse(tp.receivingLanguage(), t.receivingLanguage()),
                    Objects.requireNonNullElse(tp.displayMode(), t.displayMode()),
                    Objects.requireNonNullElse(tp.autoTranslatePosts(), t.autoTranslatePosts()),
                    Objects.requireNonNullElse(tp.autoTranslateStories(), t.autoTranslateStories()),
                    Objects.requireNonNullElse(tp.learningMode(), t.learningMode()));
        }
        if (patch.privacy() != null) {
            var pp = patch.privacy();
            if (pp.profileVisibility() != null) requireOneOf(VISIBILITY, pp.profileVisibility(), "profileVisibility");
            if (pp.whoCanMessage() != null) requireOneOf(AUDIENCES, pp.whoCanMessage(), "whoCanMessage");
            if (pp.whoCanComment() != null) requireOneOf(AUDIENCES, pp.whoCanComment(), "whoCanComment");
            if (pp.whoCanSeeOnline() != null) requireOneOf(AUDIENCES, pp.whoCanSeeOnline(), "whoCanSeeOnline");
            p = new Preferences.Privacy(
                    Objects.requireNonNullElse(pp.profileVisibility(), p.profileVisibility()),
                    Objects.requireNonNullElse(pp.whoCanMessage(), p.whoCanMessage()),
                    Objects.requireNonNullElse(pp.whoCanComment(), p.whoCanComment()),
                    Objects.requireNonNullElse(pp.whoCanSeeOnline(), p.whoCanSeeOnline()));
        }
        if (patch.notifications() != null) {
            var np = patch.notifications();
            n = new Preferences.Notifications(
                    Objects.requireNonNullElse(np.messages(), n.messages()),
                    Objects.requireNonNullElse(np.comments(), n.comments()),
                    Objects.requireNonNullElse(np.likes(), n.likes()),
                    Objects.requireNonNullElse(np.followers(), n.followers()));
        }
        String interfaceLanguage = current.interfaceLanguage();
        if (patch.interfaceLanguage() != null) {
            requireLanguage(patch.interfaceLanguage());
            interfaceLanguage = patch.interfaceLanguage();
        }
        preferences.save(viewer, new Preferences(interfaceLanguage, t, p, n));
        if ("private".equals(current.privacy().profileVisibility()) && "public".equals(p.profileVisibility())) {
            graph.approveAll(viewer);
            notifications.retractAll(viewer, "follow_request");
        }
        recordReceivingChange(viewer, current, t.receivingLanguage());
        return me(viewer);
    }

    @Transactional(readOnly = true)
    public UserProfileDto profile(UUID viewer, String username) {
        UserRow user = users.findByUsername(Usernames.normalize(username))
                .filter(UserRow::onboarded)
                .orElseThrow(() -> ApiException.notFound("User not found."));
        // A block shows a notice (blocker) or a minimal profile (blocked) instead of hiding it (PLAN.md §31.1).
        return profiles.byId(viewer, user.id()).orElseThrow();
    }

    @Transactional(readOnly = true)
    public List<UserProfileDto> suggestions(UUID viewer, int limit) {
        return profiles.list(viewer, ProfileQueries.VISIBLE_TO_VIEWER + " ORDER BY u.created_at DESC LIMIT :limit",
                Map.of("limit", clamp(limit, 1, 50)));
    }

    /** Longer queries match nothing more useful and cost more (PLAN.md §38). */
    static final int MAX_SEARCH = 50;

    @Transactional(readOnly = true)
    public List<UserProfileDto> search(UUID viewer, String query, int limit) {
        String needle = Usernames.normalize(query == null ? "" : query);
        if (needle.length() > MAX_SEARCH) needle = needle.substring(0, MAX_SEARCH);
        return profiles.list(viewer, ProfileQueries.VISIBLE_TO_VIEWER + """
                 AND (:q = '' OR u.display_name ILIKE :pattern OR u.username::text ILIKE :pattern)
                 ORDER BY u.display_name LIMIT :limit
                """, Map.of("q", needle, "pattern", com.tennotalk.common.LikePatterns.contains(needle), "limit", clamp(limit, 1, 50)));
    }

    @Transactional
    public UserProfileDto follow(UUID viewer, UUID target) {
        requireOtherVisibleUser(viewer, target);
        graph.lockPair(viewer, target);
        if (graph.blockedEitherWay(viewer, target)) throw ApiException.notFound("User not found.");
        if (graph.follows(viewer, target)) return profiles.byId(viewer, target).orElseThrow();
        if ("private".equals(preferences.profileVisibilityForShare(target))) {
            if (graph.requestFollow(viewer, target))
                notifications.notify(target, viewer, "follow_request", com.tennotalk.notifications.NotificationService.Target.none());
        } else if (graph.follow(viewer, target)) {
            notifications.notify(target, viewer, "follow", com.tennotalk.notifications.NotificationService.Target.none());
            events.publishEvent(new com.tennotalk.common.Interaction(viewer, null, target, "follow"));
        }
        return profiles.byId(viewer, target).orElseThrow();
    }

    @Transactional
    public UserProfileDto unfollow(UUID viewer, UUID target) {
        graph.lockPair(viewer, target);
        boolean wasFollowing = graph.follows(viewer, target);
        graph.unfollow(viewer, target);
        notifications.retract(target, viewer, "follow_request");
        if (wasFollowing) events.publishEvent(new com.tennotalk.common.Interaction(viewer, null, target, "unfollow"));
        return profiles.byId(viewer, target).orElseThrow(() -> ApiException.notFound("User not found."));
    }

    @Transactional(readOnly = true)
    public List<UserProfileDto> blocked(UUID viewer) {
        return profiles.list(viewer,
                "EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id = :viewer AND b.blocked_id = u.id) ORDER BY u.display_name",
                Map.of());
    }

    @Transactional(readOnly = true)
    public List<UserProfileDto> followRequests(UUID viewer) {
        return profiles.list(viewer, "EXISTS (SELECT 1 FROM follow_requests r WHERE r.followee_id = :viewer AND r.follower_id = u.id) ORDER BY u.display_name", Map.of());
    }

    @Transactional
    public void decideFollowRequest(UUID viewer, UUID follower, boolean approve) {
        graph.lockPair(viewer, follower);
        if (!graph.requested(follower, viewer)) throw ApiException.notFound("Follow request not found.");
        if (graph.blockedEitherWay(viewer, follower)) throw ApiException.notFound("Follow request not found.");
        notifications.retract(viewer, follower, "follow_request");
        if (!approve) {
            graph.rejectFollow(follower, viewer);
            return;
        }
        graph.approveFollow(follower, viewer);
        notifications.notify(follower, viewer, "follow_accepted", com.tennotalk.notifications.NotificationService.Target.none());
        events.publishEvent(new com.tennotalk.common.Interaction(follower, null, viewer, "follow"));
    }

    @Transactional
    public void block(UUID viewer, UUID target) {
        if (viewer.equals(target)) throw ApiException.validation("You can't block yourself.");
        users.findById(target).orElseThrow(() -> ApiException.notFound("User not found."));
        graph.lockPair(viewer, target);
        graph.block(viewer, target);
        // Blocking cancels follow requests both ways (SocialGraph.block), so their notifications go too.
        notifications.retract(viewer, target, "follow_request");
        notifications.retract(target, viewer, "follow_request");
    }

    @Transactional
    public void unblock(UUID viewer, UUID target) {
        graph.unblock(viewer, target);
    }

    /** LGPD right to erasure: account, content and files (PLAN.md §31). */
    @Transactional
    public void deleteAccount(UUID viewer) {
        List<String> files = jdbc.sql("SELECT storage_path FROM media WHERE owner_id = :id").param("id", viewer).query(String.class).list();
        // Conversations of two people disappear with one of them; groups keep the others.
        jdbc.sql("""
                DELETE FROM conversations c WHERE c.kind = 'direct'
                AND EXISTS (SELECT 1 FROM conversation_members m WHERE m.conversation_id = c.id AND m.user_id = :id)
                """).param("id", viewer).update();
        users.delete(viewer);
        // Files go only once the rows are gone for good: a rollback must not leave dangling media.
        org.springframework.transaction.support.TransactionSynchronizationManager.registerSynchronization(
                new org.springframework.transaction.support.TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        files.forEach(storage::delete);
                    }
                });
    }

    private void requireOtherVisibleUser(UUID viewer, UUID target) {
        if (viewer.equals(target)) throw ApiException.validation("You can't follow yourself.");
        UserRow user = users.findById(target).filter(UserRow::onboarded).orElseThrow(() -> ApiException.notFound("User not found."));
        if (graph.blockedEitherWay(viewer, user.id())) throw ApiException.notFound("User not found.");
    }

    private String checkedUsername(UUID viewer, String raw) {
        String username = Usernames.normalize(raw);
        Usernames.problem(username).ifPresent(problem -> {
            throw ApiException.validation("This username is not valid.", "username", problem);
        });
        users.findByUsername(username).filter(other -> !other.id().equals(viewer)).ifPresent(other -> {
            throw ApiException.conflict("This username is already taken.", "username", "taken");
        });
        return username;
    }

    private static final java.util.regex.Pattern AVATAR = java.util.regex.Pattern.compile("/api/media/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})");

    /**
     * Avatars are public (MediaRepository.canView), so only the user's own uploaded image may become one:
     * never another person's private file, an external tracker or a script URL.
     */
    private String checkedAvatar(UUID viewer, String url) {
        String value = blankToNull(url);
        if (value == null) return null;
        java.util.regex.Matcher matcher = AVATAR.matcher(value);
        boolean ownImage = matcher.matches() && jdbc.sql("SELECT EXISTS (SELECT 1 FROM media WHERE id = :id AND owner_id = :me AND kind = 'image')")
                .param("id", UUID.fromString(matcher.group(1))).param("me", viewer).query(Boolean.class).single();
        if (!ownImage) throw ApiException.validation("Upload a photo for your avatar.", "avatarUrl", "invalid");
        return value;
    }

    static void requireLanguage(String code) {
        if (!Languages.isSupported(code)) throw ApiException.validation("Unsupported language: " + code);
    }

    private static void requireOneOf(Set<String> allowed, String value, String field) {
        if (!allowed.contains(value)) throw ApiException.validation("Invalid value.", field, "invalid");
    }

    /** Only messages sent from now on use the new language; the past is never translated again. */
    private void recordReceivingChange(UUID viewer, Preferences current, String receiving) {
        String previous = current.translation().receivingLanguage();
        if (!Objects.equals(previous, receiving)) preferences.recordReceivingChange(viewer, previous, receiving, clock.instant());
    }

    private static Preferences withReceiving(Preferences current, String receiving) {
        var t = current.translation();
        return new Preferences(current.interfaceLanguage(),
                new Preferences.Translation(receiving, t.displayMode(), t.autoTranslatePosts(), t.autoTranslateStories(), t.learningMode()),
                current.privacy(), current.notifications());
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }
}
