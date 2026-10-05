package com.tennotalk.recommender.signals;

import com.tennotalk.recommender.Candidate;
import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.ScoreDecorator;
import com.tennotalk.recommender.Scorer;
import com.tennotalk.recommender.Viewer;

/**
 * The language-exchange heart of TENNO TALK: posts written in a language the viewer is learning, by native
 * speakers of it, and by people learning the viewer's native language (a natural conversation partner).
 */
public final class LanguageExchange extends ScoreDecorator {

    static final double POST_IN_LEARNING_LANGUAGE = 0.6;
    static final double NATIVE_SPEAKER_OF_LEARNING_LANGUAGE = 0.3;
    static final double LEARNS_MY_LANGUAGE = 0.3;

    private final double weight;

    public LanguageExchange(Scorer inner, double weight) {
        super(inner, "language-exchange");
        this.weight = weight;
    }

    @Override
    protected double adjust(RankContext context, Candidate candidate, double innerScore) {
        Viewer viewer = context.viewer();
        double signal = 0;
        if (viewer.learningLanguages().contains(candidate.language())) signal += POST_IN_LEARNING_LANGUAGE;
        if (viewer.learningLanguages().contains(candidate.authorNativeLanguage())) signal += NATIVE_SPEAKER_OF_LEARNING_LANGUAGE;
        if (!viewer.nativeLanguage().isEmpty() && candidate.authorLearningLanguages().contains(viewer.nativeLanguage())) {
            signal += LEARNS_MY_LANGUAGE;
        }
        return weight * Math.min(1, signal);
    }
}
