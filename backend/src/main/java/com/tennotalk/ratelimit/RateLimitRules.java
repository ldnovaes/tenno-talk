package com.tennotalk.ratelimit;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Which requests are limited and how much (PLAN.md §31). Keys are per user, or per IP for anonymous requests.
 * The first matching rule wins.
 */
public final class RateLimitRules {

    public record Rule(String name, String method, Pattern path, long capacity, Duration period) {
        boolean matches(String requestMethod, String requestPath) {
            return (method == null || method.equalsIgnoreCase(requestMethod)) && path.matcher(requestPath).matches();
        }
    }

    static final List<Rule> RULES = List.of(
            new Rule("auth", "POST", Pattern.compile("/api/auth/(signin|signup|password)"), 10, Duration.ofMinutes(1)),
            new Rule("send", "POST", Pattern.compile("/api/conversations/[^/]+/messages|/api/stories/[^/]+/replies"), 60, Duration.ofMinutes(1)),
            new Rule("upload", "POST", Pattern.compile("/api/media"), 30, Duration.ofMinutes(1)),
            new Rule("translate", null, Pattern.compile("/api/messages/[^/]+/(translation/retry|insight)|/api/translations/.*"), 60, Duration.ofMinutes(1)),
            new Rule("social", null, Pattern.compile("/api/profiles/[^/]+/(follow|block)|/api/posts/[^/]+/(like|comments)|/api/stories/[^/]+/reactions"), 120, Duration.ofMinutes(1)),
            new Rule("create", "POST", Pattern.compile("/api/posts|/api/stories|/api/conversations/(direct|groups)"), 30, Duration.ofMinutes(1)),
            new Rule("admin", "POST", Pattern.compile("/api/admin/.*"), 10, Duration.ofMinutes(1)));

    private RateLimitRules() {}

    public static Optional<Rule> match(String method, String path) {
        return RULES.stream().filter(rule -> rule.matches(method, path)).findFirst();
    }
}
