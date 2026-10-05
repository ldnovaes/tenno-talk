package com.tennotalk.recommender;

import java.util.List;

/** Reorders a ranked list (diversity and the like). Rerankers are {@link RerankDecorator}s around the identity. */
@FunctionalInterface
public interface Reranker {

    Reranker IDENTITY = (context, ranked) -> ranked;

    List<Ranked> rerank(RankContext context, List<Ranked> ranked);
}
