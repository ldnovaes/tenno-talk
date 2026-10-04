package com.tennotalk.push;

import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.util.Map;
import java.util.UUID;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.apache.http.client.config.RequestConfig;
import org.apache.http.impl.client.HttpClients;
import org.apache.http.util.EntityUtils;
import nl.martijndwars.webpush.Encoding;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import tools.jackson.databind.json.JsonMapper;

@Component
public class PushDelivery {
    private final JdbcClient jdbc;
    private final PushSubscriptions subscriptions;
    private final JsonMapper json;
    private final PushService sender;
    public PushDelivery(JdbcClient jdbc, PushSubscriptions subscriptions, JsonMapper json,
        @Value("${tenno.push.public-key:}") String publicKey, @Value("${tenno.push.private-key:}") String privateKey,
        @Value("${tenno.push.subject:}") String subject) throws Exception {
        this.jdbc = jdbc; this.subscriptions = subscriptions; this.json = json;
        if (Security.getProvider("BC") == null) Security.addProvider(new BouncyCastleProvider());
        sender = subscriptions.enabled() ? new PushService(publicKey, privateKey, subject) : null;
    }
    public void enqueue(UUID notification) {
        if (sender != null) jdbc.sql("INSERT INTO push_jobs(notification_id) VALUES (:id) ON CONFLICT DO NOTHING").param("id", notification).update();
    }
    record Target(UUID user, String type, UUID post, UUID story, UUID conversation, String username, UUID comment, UUID message) {}
    @Scheduled(fixedDelay = 1000)
    public synchronized void run() {
        if (sender == null) return;
        var job = jdbc.sql("""
            UPDATE push_jobs SET available_at = now() + interval '2 minutes', attempts = attempts + 1
            WHERE notification_id = (SELECT notification_id FROM push_jobs WHERE available_at <= now() ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1)
            RETURNING notification_id
            """).query(UUID.class).optional();
        if (job.isEmpty()) return;
        UUID id = job.get();
        try {
            var target = jdbc.sql("""
                SELECT n.*, u.username FROM notifications n JOIN users u ON u.id = n.actor_id
                JOIN user_preferences p ON p.user_id = n.recipient_id
                WHERE n.id = :id AND n.read_at IS NULL AND n.created_at > now() - interval '24 hours'
                AND CASE n.type WHEN 'new_message' THEN p.notify_messages WHEN 'comment' THEN p.notify_comments
                    WHEN 'follow' THEN p.notify_followers ELSE p.notify_likes END
                AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id=n.recipient_id AND b.blocked_id=n.actor_id) OR (b.blocker_id=n.actor_id AND b.blocked_id=n.recipient_id))
                AND NOT EXISTS (SELECT 1 FROM conversation_members cm WHERE cm.conversation_id=n.conversation_id AND cm.user_id=n.recipient_id AND cm.muted_until>now())
                """).param("id", id).query((rs, i) -> new Target(rs.getObject("recipient_id", UUID.class), rs.getString("type"),
                    rs.getObject("post_id", UUID.class), rs.getObject("story_id", UUID.class), rs.getObject("conversation_id", UUID.class), rs.getString("username"), rs.getObject("comment_id", UUID.class), rs.getObject("message_id", UUID.class))).optional();
            if (target.isPresent()) deliver(id, target.get());
            jdbc.sql("DELETE FROM push_jobs WHERE notification_id = :id").param("id", id).update();
        } catch (Exception error) {
            org.slf4j.LoggerFactory.getLogger(getClass()).warn("Push dispatch failed for notification {}", id);
            jdbc.sql("UPDATE push_jobs SET available_at = now() + make_interval(secs => LEAST(3600, attempts * 30)) WHERE notification_id = :id").param("id", id).update();
        }
    }
    private void deliver(UUID id, Target target) throws Exception {
        String url = switch (target.type()) {
            case "like" -> "/posts/" + target.post();
            case "comment" -> "/posts/" + target.post() + "?commentId=" + target.comment();
            case "story_reaction" -> "/stories/" + target.user() + "?storyId=" + target.story();
            case "new_message" -> "/chats/" + target.conversation() + "?messageId=" + target.message();
            case "follow" -> "/u/" + target.username();
            default -> "/notifications";
        };
        byte[] payload = json.writeValueAsString(Map.of("title", "TENNO TALK", "body", "You have new activity.", "url", url,
            "notificationId", id, "userId", target.user())).getBytes(StandardCharsets.UTF_8);
        var config = RequestConfig.custom().setConnectTimeout(5000).setSocketTimeout(5000).setConnectionRequestTimeout(5000).build();
        try (var client = HttpClients.custom().disableRedirectHandling().setDefaultRequestConfig(config).build()) {
            for (var subscription : subscriptions.forUser(target.user())) {
                boolean done = jdbc.sql("SELECT EXISTS(SELECT 1 FROM push_deliveries WHERE notification_id=:n AND subscription_id=:s)")
                    .param("n", id).param("s", subscription.id()).query(Boolean.class).single();
                if (done) continue;
                var notification = new Notification(subscription.endpoint(), subscription.p256dh(), subscription.auth(), payload, 3600);
                try (var response = client.execute(sender.preparePost(notification, Encoding.AES128GCM))) {
                    int status = response.getStatusLine().getStatusCode(); EntityUtils.consume(response.getEntity());
                    if (status == 404 || status == 410) { subscriptions.remove(subscription.id()); continue; }
                    if (status < 200 || status >= 300) throw new IllegalStateException("Push provider rejected delivery");
                    jdbc.sql("INSERT INTO push_deliveries VALUES (:n, :s) ON CONFLICT DO NOTHING").param("n", id).param("s", subscription.id()).update();
                }
            }
        }
    }
}
