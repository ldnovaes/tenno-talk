package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.ScoreDecoratorContract;
import com.tennotalk.recommender.Scorer;

class SocialProximityContractTest extends ScoreDecoratorContract {

    @Override
    protected ScoreDecorator create(Scorer inner) {
        return new SocialProximity(inner, 3.0);
    }
}
