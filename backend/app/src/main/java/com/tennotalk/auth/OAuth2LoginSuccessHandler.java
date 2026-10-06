package com.tennotalk.auth;

import java.io.IOException;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import com.tennotalk.config.TennoProperties;
import com.tennotalk.users.UserRepository;

/** Swaps the provider identity for our own session principal and goes back to the SPA. */
@Component
public class OAuth2LoginSuccessHandler implements AuthenticationSuccessHandler {

    private final OAuthAccountService accounts;
    private final SessionLogin sessionLogin;
    private final UserRepository users;
    private final TennoProperties properties;

    public OAuth2LoginSuccessHandler(OAuthAccountService accounts, SessionLogin sessionLogin, UserRepository users,
            TennoProperties properties) {
        this.accounts = accounts;
        this.sessionLogin = sessionLogin;
        this.users = users;
        this.properties = properties;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication)
            throws IOException {
        OAuth2AuthenticationToken token = (OAuth2AuthenticationToken) authentication;
        UUID userId;
        try {
            userId = accounts.resolve(identity(token.getAuthorizedClientRegistrationId(), token.getPrincipal()),
                    request.getHeader("Accept-Language"));
        } catch (OAuthAccountService.LinkRefused refused) {
            response.sendRedirect(properties.publicUrl() + "/welcome?error=oauth_link");
            return;
        }
        sessionLogin.login(userId, users.isAdmin(userId), request, response);
        response.sendRedirect(properties.publicUrl() + "/");
    }

    static OAuthAccountService.ProviderIdentity identity(String provider, OAuth2User user) {
        // Attributes are read as Object first: with a generic getAttribute, String.valueOf(...) would
        // resolve to the char[] overload and throw ClassCastException.
        Map<String, Object> attributes = user.getAttributes();
        String email = attributes.get("email") instanceof String value ? value : null;
        if ("google".equals(provider)) {
            Object verified = attributes.get("email_verified");
            return new OAuthAccountService.ProviderIdentity(provider, String.valueOf(attributes.get("sub")), email,
                    Boolean.TRUE.equals(verified) || "true".equals(String.valueOf(verified)));
        }
        // Facebook only returns confirmed emails, when it returns one at all.
        return new OAuthAccountService.ProviderIdentity(provider, String.valueOf(attributes.get("id")), email, email != null);
    }
}
