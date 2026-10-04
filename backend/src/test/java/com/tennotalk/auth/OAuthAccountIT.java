package com.tennotalk.auth;

import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.tennotalk.auth.OAuthAccountService.ProviderIdentity;
import com.tennotalk.support.IntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Who a Google/Facebook login becomes (PLAN.md §30). An unverified email must never take over an account. */
class OAuthAccountIT extends IntegrationTest {

    @Autowired
    OAuthAccountService accounts;

    private String emailOf(UUID user) {
        return jdbc.sql("SELECT email FROM users WHERE id = :id").param("id", user).query(String.class).optional().orElse(null);
    }

    private String languageOf(UUID user) {
        return jdbc.sql("SELECT native_language FROM users WHERE id = :id").param("id", user).query(String.class).single();
    }

    @Test
    void aFirstLoginCreatesAnAccountWithTheVerifiedEmailAndTheDeviceLanguage() {
        UUID user = accounts.resolve(new ProviderIdentity("google", "g-1", "New.Person@Example.com", true), "vi-VN,vi;q=0.9");
        assertThat(emailOf(user)).isEqualTo("new.person@example.com");
        assertThat(languageOf(user)).isEqualTo("vi-VN");
    }

    @Test
    void theSameProviderAccountAlwaysReturnsTheSameUser() {
        UUID first = accounts.resolve(new ProviderIdentity("google", "g-1", "a@example.com", true), "pt-BR");
        UUID second = accounts.resolve(new ProviderIdentity("google", "g-1", "changed@example.com", true), "pt-BR");
        assertThat(second).isEqualTo(first);
        assertThat(jdbc.sql("SELECT count(*) FROM users").query(Long.class).single()).isOne();
    }

    @Test
    void aVerifiedEmailLinksToTheExistingPasswordAccount() throws Exception {
        mvc.perform(withJson(post("/api/auth/signup"), Map.of("email", "lucas@example.com", "password", "secret123")))
                .andExpect(status().isCreated());
        UUID existing = jdbc.sql("SELECT id FROM users WHERE email = 'lucas@example.com'").query(UUID.class).single();

        UUID viaGoogle = accounts.resolve(new ProviderIdentity("google", "g-9", "LUCAS@example.com", true), "pt-BR");
        UUID viaFacebook = accounts.resolve(new ProviderIdentity("facebook", "f-9", "lucas@example.com", true), "pt-BR");
        assertThat(viaGoogle).isEqualTo(existing);
        assertThat(viaFacebook).isEqualTo(existing);
        assertThat(jdbc.sql("SELECT count(*) FROM oauth_accounts WHERE user_id = :u").param("u", existing).query(Long.class).single())
                .isEqualTo(2);
    }

    @Test
    void anUnverifiedEmailNeverTakesOverAnAccount() throws Exception {
        mvc.perform(withJson(post("/api/auth/signup"), Map.of("email", "victim@example.com", "password", "secret123")))
                .andExpect(status().isCreated());
        UUID victim = jdbc.sql("SELECT id FROM users WHERE email = 'victim@example.com'").query(UUID.class).single();

        UUID attacker = accounts.resolve(new ProviderIdentity("google", "g-evil", "victim@example.com", false), "en-US");
        assertThat(attacker).isNotEqualTo(victim);
        // Nor does it claim the address on the new account.
        assertThat(emailOf(attacker)).isNull();
    }

    @Test
    void anUnverifiedEmailIsNotStoredOnANewAccount() {
        UUID user = accounts.resolve(new ProviderIdentity("google", "g-2", "maybe@example.com", false), "en-US");
        assertThat(emailOf(user)).isNull();
    }

    @Test
    void facebookWithoutEmailStillCreatesAnAccount() {
        UUID user = accounts.resolve(new ProviderIdentity("facebook", "f-1", null, false), "es-ES");
        assertThat(emailOf(user)).isNull();
        assertThat(languageOf(user)).isEqualTo("es-ES");
        assertThat(accounts.resolve(new ProviderIdentity("facebook", "f-1", null, false), "es-ES")).isEqualTo(user);
    }

    @Test
    void withoutConfiguredProvidersNoSocialLoginIsOffered() throws Exception {
        mvc.perform(get("/api/auth/providers")).andExpect(status().isOk()).andExpect(jsonPath("$.providers").isEmpty());
        // The OAuth endpoints are not even there.
        int code = mvc.perform(get("/oauth2/authorization/google")).andReturn().getResponse().getStatus();
        assertThat(code).isNotEqualTo(302);
    }
}
