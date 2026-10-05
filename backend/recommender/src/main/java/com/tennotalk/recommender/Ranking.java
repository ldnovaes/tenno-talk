package com.tennotalk.recommender;

import java.util.List;
import java.util.UUID;

/** The result of a ranking call: posts in display order. */
public record Ranking(List<Ranked> items, Diagnostics diagnostics) {

    public Ranking {
        items = items == null ? List.of() : List.copyOf(items);
    }

    public List<UUID> postIds() {
        return items.stream().map(Ranked::postId).toList();
    }
}
