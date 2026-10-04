package com.tennotalk.auth;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;

import com.tennotalk.config.TennoProperties;
import com.tennotalk.config.TennoProperties.Client;

import static org.assertj.core.api.Assertions.assertThat;

class OAuthClientsTest {

    private static TennoProperties.OAuth oauth(Client google, Client facebook) {
        return new TennoProperties.OAuth(google, facebook);
    }

    @Test
    void noProviderConfiguredMeansNoSocialLogin() {
        assertThat(OAuthClients.registrations(oauth(new Client("", ""), new Client(null, null)))).isEmpty();
        assertThat(OAuthClients.registrations(null)).isEmpty();
    }

    @Test
    void aProviderNeedsBothIdAndSecret() {
        assertThat(OAuthClients.registrations(oauth(new Client("id", " "), new Client("", "secret")))).isEmpty();
    }

    @Test
    void googleAloneIsOfferedWithOpenIdScopes() {
        var registrations = OAuthClients.registrations(oauth(new Client("gid", "gsecret"), new Client("", "")));
        assertThat(registrations).hasSize(1);
        var google = registrations.getFirst();
        assertThat(google.getRegistrationId()).isEqualTo("google");
        assertThat(google.getClientId()).isEqualTo("gid");
        assertThat(google.getScopes()).containsExactlyInAnyOrder("openid", "email", "profile");
        assertThat(google.getRedirectUri()).isEqualTo("{baseUrl}/{action}/oauth2/code/{registrationId}");
    }

    @Test
    void bothProvidersInAStableOrder() {
        var registrations = OAuthClients.registrations(oauth(new Client("g", "s"), new Client("f", "s")));
        assertThat(registrations).extracting(r -> r.getRegistrationId()).containsExactly("google", "facebook");
        assertThat(registrations.get(1).getScopes()).containsExactlyInAnyOrder("email", "public_profile");
    }

    // ---- identity mapping (OAuth2LoginSuccessHandler) ------------------------

    private static DefaultOAuth2User user(Map<String, Object> attributes, String nameKey) {
        return new DefaultOAuth2User(java.util.List.of(), attributes, nameKey);
    }

    @Test
    void googleEmailsCountOnlyWhenVerified() {
        var verified = OAuth2LoginSuccessHandler.identity("google",
                user(Map.of("sub", "g-1", "email", "a@example.com", "email_verified", true), "sub"));
        assertThat(verified).isEqualTo(new OAuthAccountService.ProviderIdentity("google", "g-1", "a@example.com", true));

        var asText = OAuth2LoginSuccessHandler.identity("google",
                user(Map.of("sub", "g-2", "email", "b@example.com", "email_verified", "true"), "sub"));
        assertThat(asText.emailVerified()).isTrue();

        var unverified = OAuth2LoginSuccessHandler.identity("google",
                user(Map.of("sub", "g-3", "email", "c@example.com", "email_verified", false), "sub"));
        assertThat(unverified.emailVerified()).isFalse();

        var missingFlag = OAuth2LoginSuccessHandler.identity("google", user(Map.of("sub", "g-4", "email", "d@example.com"), "sub"));
        assertThat(missingFlag.emailVerified()).isFalse();
    }

    @Test
    void facebookMayHaveNoEmail() {
        var withEmail = OAuth2LoginSuccessHandler.identity("facebook", user(Map.of("id", "f-1", "email", "e@example.com"), "id"));
        assertThat(withEmail).isEqualTo(new OAuthAccountService.ProviderIdentity("facebook", "f-1", "e@example.com", true));
        var withoutEmail = OAuth2LoginSuccessHandler.identity("facebook", user(Map.of("id", "f-2"), "id"));
        assertThat(withoutEmail).isEqualTo(new OAuthAccountService.ProviderIdentity("facebook", "f-2", null, false));
    }
}
