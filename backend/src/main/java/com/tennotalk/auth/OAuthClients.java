package com.tennotalk.auth;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.ClientRegistration;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.stereotype.Component;

import com.tennotalk.config.TennoProperties;

/**
 * Google and Facebook sign-in, each offered only when configured (PLAN.md §30). Starting with email
 * and password and adding a provider later must not stop the server from booting (R16).
 */
@Component
public class OAuthClients {

    private final List<ClientRegistration> registrations;

    public OAuthClients(TennoProperties properties) {
        this.registrations = registrations(properties.oauth());
    }

    static List<ClientRegistration> registrations(TennoProperties.OAuth oauth) {
        List<ClientRegistration> result = new ArrayList<>();
        if (oauth == null) return result;
        if (oauth.google() != null && oauth.google().configured()) {
            result.add(CommonOAuth2Provider.GOOGLE.getBuilder("google")
                    .clientId(oauth.google().clientId())
                    .clientSecret(oauth.google().clientSecret())
                    .scope("openid", "email", "profile")
                    .build());
        }
        if (oauth.facebook() != null && oauth.facebook().configured()) {
            result.add(CommonOAuth2Provider.FACEBOOK.getBuilder("facebook")
                    .clientId(oauth.facebook().clientId())
                    .clientSecret(oauth.facebook().clientSecret())
                    .scope("email", "public_profile")
                    .build());
        }
        return List.copyOf(result);
    }

    /** "google", "facebook": what the welcome page may show. */
    public List<String> enabled() {
        return registrations.stream().map(ClientRegistration::getRegistrationId).toList();
    }

    public Optional<ClientRegistrationRepository> repository() {
        return registrations.isEmpty() ? Optional.empty() : Optional.of(new InMemoryClientRegistrationRepository(registrations));
    }
}
