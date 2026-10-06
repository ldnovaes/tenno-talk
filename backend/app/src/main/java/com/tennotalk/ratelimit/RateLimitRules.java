package com.tennotalk.ratelimit;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Which requests are limited and how much (PLAN.md §31). Keys are per user, or per IP for anonymous requests.
 * The first matching rule wins; rules with the same name share one bucket. Reads are never limited, except those
 * that cost AI (insight) or a database dump (export).
 */
public final class RateLimitRules {

    public record Rule(String name, String method, Pattern path, long capacity, Duration period) {
        boolean matches(String requestMethod, String requestPath) {
            return (method == null || method.equalsIgnoreCase(requestMethod)) && path.matcher(requestPath).matches();
        }
    }

    static final List<Rule> RULES = List.of(
            new Rule("auth", "POST", Pattern.compile("/api/auth/(signin|signup|password)"), 10, Duration.ofMinutes(1)),
            new Rule("send", "POST", Pattern.compile("/api/conversations/[^/]+/messages|/api/stories/[^/]+/replies|/api/messages/[^/]+/forward"), 60, Duration.ofMinutes(1)),
            new Rule("upload", "POST", Pattern.compile("/api/media"), 30, Duration.ofMinutes(1)),
            new Rule("translate", null, Pattern.compile("/api/messages/[^/]+/(translation/retry|insight)|/api/translations/.*"), 60, Duration.ofMinutes(1)),
            new Rule("discover", null, Pattern.compile("/api/discover/(events|hidden/.*)"), 120, Duration.ofMinutes(1)),
            new Rule("social", null, Pattern.compile("/api/profiles/[^/]+/(follow|block)|/api/posts/[^/]+/like|/api/(stories|messages)/[^/]+/reactions"), 120, Duration.ofMinutes(1)),
            new Rule("social", "POST", Pattern.compile("/api/posts/[^/]+/comments"), 120, Duration.ofMinutes(1)),
            new Rule("create", "POST", Pattern.compile("/api/posts|/api/stories|/api/conversations/(direct|groups)"), 30, Duration.ofMinutes(1)),
            new Rule("report", "POST", Pattern.compile("/api/reports"), 20, Duration.ofHours(1)),
            new Rule("export", "GET", Pattern.compile("/api/me/export"), 5, Duration.ofHours(1)),
            new Rule("admin", "POST", Pattern.compile("/api/admin/.*"), 10, Duration.ofMinutes(1)));

    private RateLimitRules() {}

    public static Optional<Rule> match(String method, String path) {
        return RULES.stream().filter(rule -> rule.matches(method, path)).findFirst();
    }
}
