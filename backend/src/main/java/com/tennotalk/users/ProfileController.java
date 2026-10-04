package com.tennotalk.users;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.auth.AppPrincipal;
import com.tennotalk.auth.SessionLogin;
import com.tennotalk.common.Ids;
import com.tennotalk.common.PageDto;
import com.tennotalk.users.ProfileInputs.AcceptTerms;
import com.tennotalk.users.ProfileInputs.CompleteOnboarding;
import com.tennotalk.users.ProfileInputs.PreferencesPatch;
import com.tennotalk.users.ProfileInputs.UpdateProfile;
import com.tennotalk.users.UserDtos.CurrentUserDto;
import com.tennotalk.users.UserDtos.UserProfileDto;

@RestController
@RequestMapping("/api")
public class ProfileController {

    private final ProfileService profiles;
    private final SessionLogin sessionLogin;

    private final DataExportService exports;

    public ProfileController(ProfileService profiles, SessionLogin sessionLogin, DataExportService exports) {
        this.exports = exports;
        this.profiles = profiles;
        this.sessionLogin = sessionLogin;
    }

    @GetMapping("/me")
    public CurrentUserDto me(@AuthenticationPrincipal AppPrincipal me) {
        return profiles.me(me.userId());
    }

    @PostMapping("/me/terms")
    public CurrentUserDto acceptTerms(@AuthenticationPrincipal AppPrincipal me, @Valid @RequestBody AcceptTerms body,
            HttpServletRequest request) {
        return profiles.acceptTerms(me.userId(), body.version(), request.getRemoteAddr(), request.getHeader("User-Agent"));
    }

    @PostMapping("/me/onboarding")
    public CurrentUserDto completeOnboarding(@AuthenticationPrincipal AppPrincipal me, @Valid @RequestBody CompleteOnboarding body) {
        return profiles.completeOnboarding(me.userId(), body);
    }

    @PutMapping("/me/profile")
    public CurrentUserDto updateProfile(@AuthenticationPrincipal AppPrincipal me, @Valid @RequestBody UpdateProfile body) {
        return profiles.updateProfile(me.userId(), body);
    }

    @PatchMapping("/me/preferences")
    public CurrentUserDto updatePreferences(@AuthenticationPrincipal AppPrincipal me, @RequestBody PreferencesPatch body) {
        return profiles.updatePreferences(me.userId(), body);
    }

    /** LGPD: a copy of everything stored about the account. */
    @GetMapping("/me/export")
    public org.springframework.http.ResponseEntity<tools.jackson.databind.node.ObjectNode> export(@AuthenticationPrincipal AppPrincipal me) {
        return org.springframework.http.ResponseEntity.ok()
                .header(org.springframework.http.HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"tenno-talk-data.json\"")
                .cacheControl(org.springframework.http.CacheControl.noStore())
                .body(exports.export(me.userId()));
    }

    @DeleteMapping("/me")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@AuthenticationPrincipal AppPrincipal me, HttpServletRequest request) {
        profiles.deleteAccount(me.userId());
        sessionLogin.logout(request);
    }

    @GetMapping("/usernames/{username}/availability")
    public Map<String, Boolean> usernameAvailability(@AuthenticationPrincipal AppPrincipal me, @PathVariable String username) {
        return Map.of("available", profiles.usernameAvailable(me.userId(), username));
    }

    @GetMapping("/profiles/{username}")
    public UserProfileDto profile(@AuthenticationPrincipal AppPrincipal me, @PathVariable String username) {
        return profiles.profile(me.userId(), username);
    }

    @PutMapping("/profiles/{userId}/follow")
    public UserProfileDto follow(@AuthenticationPrincipal AppPrincipal me, @PathVariable String userId) {
        return profiles.follow(me.userId(), Ids.parse(userId));
    }

    @DeleteMapping("/profiles/{userId}/follow")
    public UserProfileDto unfollow(@AuthenticationPrincipal AppPrincipal me, @PathVariable String userId) {
        return profiles.unfollow(me.userId(), Ids.parse(userId));
    }

    @PutMapping("/profiles/{userId}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void block(@AuthenticationPrincipal AppPrincipal me, @PathVariable String userId) {
        profiles.block(me.userId(), Ids.parse(userId));
    }

    @DeleteMapping("/profiles/{userId}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unblock(@AuthenticationPrincipal AppPrincipal me, @PathVariable String userId) {
        profiles.unblock(me.userId(), Ids.parse(userId));
    }

    @GetMapping("/me/blocked")
    public List<UserProfileDto> blocked(@AuthenticationPrincipal AppPrincipal me) {
        return profiles.blocked(me.userId());
    }

    @GetMapping("/people/suggestions")
    public List<UserProfileDto> suggestions(@AuthenticationPrincipal AppPrincipal me, @RequestParam(defaultValue = "6") int limit) {
        return profiles.suggestions(me.userId(), limit);
    }

    @GetMapping("/people/search")
    public List<UserProfileDto> search(@AuthenticationPrincipal AppPrincipal me, @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "20") int limit) {
        return profiles.search(me.userId(), q, limit);
    }

    @GetMapping("/discover")
    public PageDto<UserProfileDto> discover(@AuthenticationPrincipal AppPrincipal me,
            @RequestParam(required = false) String nativeLanguage, @RequestParam(required = false) String cursor) {
        return profiles.discover(me.userId(), nativeLanguage, cursor);
    }
}
