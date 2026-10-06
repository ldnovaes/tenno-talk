package com.tennotalk.ratelimit;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.tennotalk.auth.AppPrincipal;
import com.tennotalk.common.ErrorCode;
import com.tennotalk.common.ProblemWriter;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;

/** In-memory token buckets; one VPS, one instance (PLAN.md §32). Runs after Spring Security, so the user is known. */
@Component
@ConditionalOnProperty(prefix = "tenno.rate-limit", name = "enabled", havingValue = "true", matchIfMissing = true)
public class RateLimitFilter extends OncePerRequestFilter {

    /** A bucket and when it was last used (to forget it once it is full again). */
    private record Entry(RateLimitRules.Rule rule, Bucket bucket, AtomicLong lastUsed) {}

    private final Map<String, Entry> buckets = new ConcurrentHashMap<>();

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Optional<RateLimitRules.Rule> rule = RateLimitRules.match(request.getMethod(), request.getRequestURI());
        if (rule.isEmpty()) {
            chain.doFilter(request, response);
            return;
        }
        RateLimitRules.Rule limit = rule.get();
        Entry entry = buckets.computeIfAbsent(limit.name() + ":" + who(request), key -> new Entry(limit, build(limit), new AtomicLong()));
        entry.lastUsed().set(System.nanoTime());
        ConsumptionProbe probe = entry.bucket().tryConsumeAndReturnRemaining(1);
        if (probe.isConsumed()) {
            chain.doFilter(request, response);
            return;
        }
        long seconds = Math.max(1, TimeUnit.NANOSECONDS.toSeconds(probe.getNanosToWaitForRefill()) + 1);
        response.setHeader("Retry-After", Long.toString(seconds));
        ProblemWriter.write(response, ErrorCode.RATE_LIMITED, "Too many requests. Try again in a moment.");
    }

    private static String who(HttpServletRequest request) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AppPrincipal principal) return "u:" + principal.userId();
        return "ip:" + request.getRemoteAddr();
    }

    private static Bucket build(RateLimitRules.Rule rule) {
        var builder = Bucket.builder();
        for (RateLimitRules.Limit limit : rule.limits()) {
            builder.addLimit(l -> l.capacity(limit.capacity()).refillGreedy(limit.capacity(), limit.period()));
        }
        return builder.build();
    }

    /** A bucket unused for its longest period is full again and carries no information; dropping it bounds memory. */
    @Scheduled(fixedDelayString = "PT10M")
    void evictIdle() {
        long now = System.nanoTime();
        buckets.values().removeIf(entry -> now - entry.lastUsed().get() > entry.rule().refillTime().toNanos());
    }

    int size() {
        return buckets.size();
    }

    /** Test hook: start from full buckets. */
    public void reset() {
        buckets.clear();
    }
}
