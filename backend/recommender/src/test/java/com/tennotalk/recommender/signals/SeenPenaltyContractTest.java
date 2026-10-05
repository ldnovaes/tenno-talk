package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.ScoreDecoratorContract;
import com.tennotalk.recommender.Scorer;

class SeenPenaltyContractTest extends ScoreDecoratorContract {

    @Override
    protected ScoreDecorator create(Scorer inner) {
        return new SeenPenalty(inner, 3.0);
    }
}
