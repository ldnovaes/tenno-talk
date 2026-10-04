package com.tennotalk.push;

import java.net.URI;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.tennotalk.common.ApiException;

@Service
public class PushSubscriptions {
    private final JdbcClient jdbc;
    private final String publicKey;
    private final String privateKey;
    public PushSubscriptions(JdbcClient jdbc, @Value("${tenno.push.public-key:}") String publicKey,
        @Value("${tenno.push.private-key:}") String privateKey) {
        this.jdbc = jdbc; this.publicKey = publicKey; this.privateKey = privateKey;
    }
    public record Subscription(UUID id, String endpoint, String p256dh, String auth) {}
    public boolean enabled() { return !publicKey.isBlank() && !privateKey.isBlank(); }
    public String publicKey() { return enabled() ? publicKey : ""; }
    public static void validate(String endpoint, String key, String auth) {
        try {
            URI uri = URI.create(endpoint);
            String host = uri.getHost();
            boolean allowed = host != null && (host.equals("fcm.googleapis.com") || host.equals("updates.push.services.mozilla.com")
                || host.endsWith(".push.services.mozilla.com") || host.equals("web.push.apple.com") || host.endsWith(".notify.windows.com") || host.endsWith(".wns.windows.com"));
            if (!allowed || !"https".equals(uri.getScheme()) || uri.getUserInfo() != null || uri.getFragment() != null || (uri.getPort() != -1 && uri.getPort() != 443)
                || Base64.getUrlDecoder().decode(key).length != 65 || Base64.getUrlDecoder().decode(auth).length != 16) throw new IllegalArgumentException();
        } catch (RuntimeException invalid) { throw ApiException.validation("Invalid push subscription."); }
    }
    @Transactional
    public void subscribe(UUID user, String endpoint, String key, String auth) {
        if (!enabled()) throw ApiException.validation("Push notifications are not configured.");
        validate(endpoint, key, auth);
        // Rebind a browser subscription to its current signed-in account.
        jdbc.sql("""
            INSERT INTO push_subscriptions(id, user_id, endpoint, p256dh, auth) VALUES (:id, :u, :e, :k, :a)
            ON CONFLICT(endpoint) DO UPDATE SET user_id = :u, p256dh = :k, auth = :a
            """).param("id", UUID.randomUUID()).param("u", user).param("e", endpoint).param("k", key).param("a", auth).update();
    }
    @Transactional public void remove(UUID user, String endpoint) {
        jdbc.sql("DELETE FROM push_subscriptions WHERE user_id = :u AND endpoint = :e").param("u", user).param("e", endpoint).update();
    }
    public void remove(UUID id) { jdbc.sql("DELETE FROM push_subscriptions WHERE id = :id").param("id", id).update(); }
    public List<Subscription> forUser(UUID user) {
        return jdbc.sql("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = :u")
            .param("u", user).query((rs, i) -> new Subscription(rs.getObject("id", UUID.class), rs.getString("endpoint"), rs.getString("p256dh"), rs.getString("auth"))).list();
    }
}
