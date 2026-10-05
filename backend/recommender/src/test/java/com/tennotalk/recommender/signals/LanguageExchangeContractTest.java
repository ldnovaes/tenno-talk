package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.ScoreDecoratorContract;
import com.tennotalk.recommender.Scorer;

class LanguageExchangeContractTest extends ScoreDecoratorContract {

    @Override
    protected ScoreDecorator create(Scorer inner) {
        return new LanguageExchange(inner, 3.0);
    }
}
