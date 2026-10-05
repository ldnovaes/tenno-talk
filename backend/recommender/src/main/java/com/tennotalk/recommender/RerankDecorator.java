package com.tennotalk.recommender;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The only way to change the order after scoring. {@link #rerank} is final: the result must be a
 * permutation of the input (nothing added, nothing lost); otherwise, or on any exception, the inner
 * order is kept and the failure is accounted for. Implementations must be stateless; a contract test is mandatory.
 */
public abstract class RerankDecorator implements Reranker {

    private final Reranker inner;
    private final String name;

    protected RerankDecorator(Reranker inner, String name) {
        this.inner = inner == null ? Reranker.IDENTITY : inner;
        this.name = name == null || name.isBlank() ? getClass().getSimpleName() : name.strip();
    }

    public final String name() {
        return name;
    }

    /** A new order for {@code ranked}, which is already in the inner order. */
    protected abstract List<Ranked> reorder(RankContext context, List<Ranked> ranked);

    @Override
    public final List<Ranked> rerank(RankContext context, List<Ranked> ranked) {
        List<Ranked> base = inner.rerank(context, ranked);
        if (!context.enabled(name)) return base;
        long started = context.tick();
        List<Ranked> result;
        try {
            result = reorder(context, base);
        } catch (Throwable failure) {
            context.spent(name, context.tick() - started);
            context.failed(name);
            return base;
        }
        context.spent(name, context.tick() - started);
        if (!isPermutation(base, result)) {
            context.failed(name);
            return base;
        }
        return List.copyOf(result);
    }

    static boolean isPermutation(List<Ranked> expected, List<Ranked> actual) {
        if (actual == null || actual.size() != expected.size()) return false;
        Set<UUID> wanted = new HashSet<>();
        for (Ranked item : expected) wanted.add(item.postId());
        Set<UUID> seen = new HashSet<>();
        for (Ranked item : actual) {
            if (item == null || item.candidate() == null || !wanted.contains(item.postId()) || !seen.add(item.postId())) return false;
            if (!Double.isFinite(item.score())) return false;
        }
        return true;
    }
}
