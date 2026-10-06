package com.tennotalk.auth;

import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tennotalk.common.Ids;
import com.tennotalk.users.UserRepository;

/**
 * Finds or creates the account behind a Google/Facebook login (PLAN.md §30, §38).
 * A verified email links to an existing account with the same email, unless that account has a password and its
 * email was never confirmed: whoever signed up with it may not own the address (account pre-hijacking).
 */
@Service
public class OAuthAccountService {

    public record ProviderIdentity(String provider, String providerUserId, String email, boolean emailVerified) {}

    /** The address belongs to a password account whose email was never confirmed: sign in with the password. */
    public static final class LinkRefused extends RuntimeException {
        LinkRefused() {
            super("An account with this email already exists; sign in with its password.");
        }
    }

    private final JdbcClient jdbc;
    private final UserRepository users;

    public OAuthAccountService(JdbcClient jdbc, UserRepository users) {
        this.jdbc = jdbc;
        this.users = users;
    }

    @Transactional
    public UUID resolve(ProviderIdentity identity, String acceptLanguage) {
        Optional<UUID> linked = jdbc.sql("SELECT user_id FROM oauth_accounts WHERE provider = :p AND provider_user_id = :id")
                .param("p", identity.provider())
                .param("id", identity.providerUserId())
                .query(UUID.class)
                .optional();
        if (linked.isPresent()) return linked.get();

        String email = identity.email() == null ? null : AuthService.normalizeEmail(identity.email());
        UUID userId = email != null && identity.emailVerified()
                ? users.findByEmail(email).map(user -> user.id()).orElse(null)
                : null;
        if (userId != null && unconfirmedPasswordAccount(userId)) throw new LinkRefused();
        if (userId == null) {
            userId = Ids.newId();
            // An unverified or missing email (Facebook may omit it, R16) never claims an address.
            String storedEmail = identity.emailVerified() && email != null && users.findByEmail(email).isEmpty() ? email : null;
            users.insert(userId, storedEmail, null, AcceptLanguage.detect(acceptLanguage));
        }
        jdbc.sql("INSERT INTO oauth_accounts (provider, provider_user_id, user_id, email) VALUES (:p, :id, :user, :email)")
                .param("p", identity.provider())
                .param("id", identity.providerUserId())
                .param("user", userId)
                .param("email", email)
                .update();
        return userId;
    }

    private boolean unconfirmedPasswordAccount(UUID userId) {
        return jdbc.sql("SELECT password_hash IS NOT NULL AND email_verified_at IS NULL FROM users WHERE id = :id")
                .param("id", userId).query(Boolean.class).single();
    }
}
