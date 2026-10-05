package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.ScoreDecoratorContract;
import com.tennotalk.recommender.Scorer;

class AuthorAffinityContractTest extends ScoreDecoratorContract {

    @Override
    protected ScoreDecorator create(Scorer inner) {
        return new AuthorAffinity(inner, 3.0);
    }
}
