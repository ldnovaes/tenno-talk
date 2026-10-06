package com.tennotalk.ratelimit;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Which requests are limited and how much (PLAN.md §31, §38). Keys are per user, or per IP for anonymous requests.
 * The first matching rule wins; rules with the same name share one bucket. A rule may have several limits (per
 * minute and per day): every one must have room. Any other read shares one generous bucket.
 */
public final class RateLimitRules {

    public record Limit(long capacity, Duration period) {}

    public record Rule(String name, String method, Pattern path, List<Limit> limits) {

        Rule(String name, String method, Pattern path, long capacity, Duration period) {
            this(name, method, path, List.of(new Limit(capacity, period)));
        }

        boolean matches(String requestMethod, String requestPath) {
            return (method == null || method.equalsIgnoreCase(requestMethod)) && path.matcher(requestPath).matches();
        }

        /** After this long without a request the bucket is full again, so forgetting it changes nothing. */
        Duration refillTime() {
            return limits.stream().map(Limit::period).max(Duration::compareTo).orElse(Duration.ZERO);
        }
    }

    private static final Duration MINUTE = Duration.ofMinutes(1);

    static final List<Rule> RULES = List.of(
            new Rule("auth", "POST", Pattern.compile("/api/auth/(signin|signup|password)"), 10, MINUTE),
            // One forward reaches up to 20 conversations, each translated again: a bucket of its own.
            new Rule("forward", "POST", Pattern.compile("/api/messages/[^/]+/forward"), 10, MINUTE),
            new Rule("send", "POST", Pattern.compile("/api/conversations/[^/]+/messages|/api/stories/[^/]+/(replies|reactions)"), 60, MINUTE),
            new Rule("upload", "POST", Pattern.compile("/api/media"), 30, MINUTE),
            new Rule("translate", null, Pattern.compile("/api/messages/[^/]+/(translation/retry|insight)|/api/translations/.*"),
                    List.of(new Limit(60, MINUTE), new Limit(500, Duration.ofDays(1)))),
            new Rule("discover", null, Pattern.compile("/api/discover/(events|hidden/.*)"), 120, MINUTE),
            new Rule("social", null, Pattern.compile("/api/profiles/[^/]+/(follow|block)|/api/posts/[^/]+/like|/api/messages/[^/]+/reactions"), 120, MINUTE),
            new Rule("social", "POST", Pattern.compile("/api/posts/[^/]+/comments"), 120, MINUTE),
            new Rule("create", "POST", Pattern.compile("/api/posts|/api/stories|/api/conversations/(direct|groups)"), 30, MINUTE),
            new Rule("report", "POST", Pattern.compile("/api/reports"), 20, Duration.ofHours(1)),
            new Rule("export", "GET", Pattern.compile("/api/me/export"), 5, Duration.ofHours(1)),
            new Rule("admin", "POST", Pattern.compile("/api/admin/.*"), 10, MINUTE),
            // Each preference change can add history that every send reads; push devices are capped too.
            new Rule("settings", "PATCH", Pattern.compile("/api/me/preferences"), 30, MINUTE),
            new Rule("settings", "PUT", Pattern.compile("/api/me/profile"), 30, MINUTE),
            new Rule("settings", null, Pattern.compile("/api/push/subscriptions"), 30, MINUTE),
            new Rule("receipts", "POST", Pattern.compile("/api/conversations/[^/]+/(delivered|read)"), 600, MINUTE),
            new Rule("search", "GET", Pattern.compile("/api/people/(search|suggestions)"), 60, MINUTE),
            new Rule("read", "GET", Pattern.compile("/api/.*"), 1200, MINUTE));

    private RateLimitRules() {}

    public static Optional<Rule> match(String method, String path) {
        return RULES.stream().filter(rule -> rule.matches(method, path)).findFirst();
    }
}
