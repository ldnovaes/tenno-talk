package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.ScoreDecoratorContract;
import com.tennotalk.recommender.Scorer;

class EngagementContractTest extends ScoreDecoratorContract {

    @Override
    protected ScoreDecorator create(Scorer inner) {
        return new Engagement(inner, 3.0);
    }
}
