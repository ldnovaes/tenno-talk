package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.RerankDecorator;
import com.tennotalk.recommender.RerankDecoratorContract;
import com.tennotalk.recommender.Reranker;

class AuthorSpacingContractTest extends RerankDecoratorContract {

    @Override
    protected RerankDecorator create(Reranker inner) {
        return new AuthorSpacing(inner, 4);
    }
}
