package com.tennotalk.auth;

import java.util.Locale;
import java.util.UUID;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.tennotalk.common.ApiException;
import com.tennotalk.common.ErrorCode;
import com.tennotalk.common.Ids;
import com.tennotalk.users.UserRepository;
import com.tennotalk.users.UserRow;

@Service
public class AuthService {

    /** Hash checked even for unknown emails, so timing does not reveal accounts. */
    private static final String DUMMY_HASH_SEED = "tenno-dummy-password";

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final LoginThrottle throttle;
    private final String dummyHash;

    public AuthService(UserRepository users, PasswordEncoder encoder, LoginThrottle throttle) {
        this.users = users;
        this.encoder = encoder;
        this.throttle = throttle;
        this.dummyHash = encoder.encode(DUMMY_HASH_SEED);
    }

    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public UUID signUp(String email, String password, String acceptLanguage) {
        String normalized = normalizeEmail(email);
        if (users.findByEmail(normalized).isPresent()) {
            throw ApiException.conflict("An account with this email already exists.", "email",
                    "An account with this email already exists.");
        }
        UUID id = Ids.newId();
        users.insert(id, normalized, encoder.encode(password), AcceptLanguage.detect(acceptLanguage));
        return id;
    }

    @Transactional(readOnly = true)
    public UserRow signIn(String email, String password) {
        String normalized = normalizeEmail(email);
        throttle.requireAllowed(normalized);
        var user = users.findByEmail(normalized);
        String hash = user.map(UserRow::passwordHash).orElse(null);
        boolean matches = encoder.matches(password, hash == null ? dummyHash : hash);
        if (user.isEmpty() || hash == null || !matches) {
            throttle.failed(normalized);
            throw new ApiException(ErrorCode.UNAUTHENTICATED, "Invalid email or password.");
        }
        return user.get();
    }

    @Transactional
    public void changePassword(UUID userId, String current, String next) {
        UserRow user = users.require(userId);
        if (user.passwordHash() != null && (current == null || !encoder.matches(current, user.passwordHash()))) {
            throw ApiException.validation("Your current password is not correct.", "current",
                    "Your current password is not correct.");
        }
        users.updatePassword(userId, encoder.encode(next));
    }
}
