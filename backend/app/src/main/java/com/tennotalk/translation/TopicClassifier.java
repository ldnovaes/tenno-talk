package com.tennotalk.translation;

import java.util.List;

/** An AI provider that also labels posts with topics of a given taxonomy (PLAN.md §37.5). */
public interface TopicClassifier {

    /** At most {@link TopicsJson#MAX_TOPICS} codes from {@code taxonomy}, most relevant first; empty when none fits. */
    List<String> classifyTopics(String caption, List<String> taxonomy) throws TranslatorException;
}
