package com.tennotalk.ratelimit;

import java.io.IOException;
import java.util.Map;
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

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

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
        Bucket bucket = buckets.computeIfAbsent(limit.name() + ":" + who(request), key -> Bucket.builder()
                .addLimit(l -> l.capacity(limit.capacity()).refillGreedy(limit.capacity(), limit.period()))
                .build());
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
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

    /** Full buckets carry no information; dropping them keeps memory bounded. */
    @Scheduled(fixedDelayString = "PT10M")
    void evictIdle() {
        buckets.entrySet().removeIf(entry -> {
            Bucket bucket = entry.getValue();
            return bucket.getAvailableTokens() >= capacityOf(entry.getKey());
        });
    }

    private static long capacityOf(String key) {
        String name = key.substring(0, key.indexOf(':'));
        return RateLimitRules.RULES.stream().filter(r -> r.name().equals(name)).findFirst().map(RateLimitRules.Rule::capacity).orElse(0L);
    }

    /** Test hook: start from full buckets. */
    public void reset() {
        buckets.clear();
    }
}
