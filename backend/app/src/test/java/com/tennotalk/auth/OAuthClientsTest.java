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

    @Test
    void aRefusedLinkSendsThePersonBackWithoutSigningIn() throws Exception {
        var accounts = org.mockito.Mockito.mock(OAuthAccountService.class);
        org.mockito.Mockito.when(accounts.resolve(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenThrow(new OAuthAccountService.LinkRefused());
        var sessions = org.mockito.Mockito.mock(SessionLogin.class);
        var properties = new TennoProperties("https://tenno.example", "v", null, null, null, null, null);
        var handler = new OAuth2LoginSuccessHandler(accounts, sessions, null, properties);
        var user = user(Map.of("sub", "g-1", "email", "victim@example.com", "email_verified", true), "sub");
        var token = new org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken(user, user.getAuthorities(), "google");
        var response = new org.springframework.mock.web.MockHttpServletResponse();

        handler.onAuthenticationSuccess(new org.springframework.mock.web.MockHttpServletRequest(), response, token);

        assertThat(response.getRedirectedUrl()).isEqualTo("https://tenno.example/welcome?error=oauth_link");
        org.mockito.Mockito.verifyNoInteractions(sessions);
    }
}
