package com.tennotalk.translation;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import com.fasterxml.jackson.annotation.JsonPropertyDescription;

/** The structured answer of a topic classification (the SDKs derive the JSON schema from it). */
public record TopicsJson(@JsonPropertyDescription("Up to 3 codes from the taxonomy, most relevant first") List<String> topics) {

    public static final int MAX_TOPICS = 3;

    /** Only taxonomy codes, once each, at most {@link #MAX_TOPICS}: a model cannot invent topics. */
    public List<String> valid(List<String> taxonomy) {
        if (topics == null) return List.of();
        Set<String> allowed = Set.copyOf(taxonomy);
        LinkedHashSet<String> result = new LinkedHashSet<>();
        for (String topic : topics) {
            String code = topic == null ? "" : topic.strip();
            if (allowed.contains(code)) result.add(code);
            if (result.size() == MAX_TOPICS) break;
        }
        return List.copyOf(result);
    }
}
