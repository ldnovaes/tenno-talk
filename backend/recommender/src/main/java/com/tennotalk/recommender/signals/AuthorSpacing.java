package com.tennotalk.recommender.signals;

import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.ListIterator;
import java.util.UUID;

import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.Ranked;
import com.tennotalk.recommender.RerankDecorator;
import com.tennotalk.recommender.Reranker;

/**
 * One author at most once in any {@code gap} consecutive positions, so a prolific author never fills the
 * screen. Greedy and stable: the best eligible post goes next; when no post is eligible the best one goes anyway.
 */
public final class AuthorSpacing extends RerankDecorator {

    private final int gap;

    public AuthorSpacing(Reranker inner, int gap) {
        super(inner, "author-spacing");
        this.gap = Math.max(1, gap);
    }

    @Override
    protected List<Ranked> reorder(RankContext context, List<Ranked> ranked) {
        if (gap <= 1) return ranked;
        LinkedList<Ranked> pending = new LinkedList<>(ranked);
        List<Ranked> result = new ArrayList<>(ranked.size());
        while (!pending.isEmpty()) result.add(takeNext(pending, result));
        return result;
    }

    private Ranked takeNext(LinkedList<Ranked> pending, List<Ranked> placed) {
        List<UUID> recent = new ArrayList<>(gap - 1);
        for (int i = Math.max(0, placed.size() - (gap - 1)); i < placed.size(); i++) recent.add(placed.get(i).authorId());
        ListIterator<Ranked> iterator = pending.listIterator();
        while (iterator.hasNext()) {
            Ranked candidate = iterator.next();
            if (!recent.contains(candidate.authorId())) {
                iterator.remove();
                return candidate;
            }
        }
        return pending.removeFirst();
    }
}
