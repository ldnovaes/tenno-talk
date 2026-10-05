package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.RerankDecorator;
import com.tennotalk.recommender.RerankDecoratorContract;
import com.tennotalk.recommender.Reranker;

class TopicDiversityContractTest extends RerankDecoratorContract {

    @Override
    protected RerankDecorator create(Reranker inner) {
        return new TopicDiversity(inner, 0.5);
    }
}
