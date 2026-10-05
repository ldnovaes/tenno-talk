package com.tennotalk.recommender.learning;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Hashtags of a caption, in any script: "#Café", "#東京", "#ภาษาไทย". Normalized with NFKC (so "＃" and
 * full-width letters work) and lowercased; repeated tags count once. Never throws.
 */
public final class Hashtags {

    public static final int MAX_TAGS = 30;
    public static final int MIN_LENGTH = 2;
    public static final int MAX_LENGTH = 50;
    public static final String TAG_PREFIX = "tag:";

    private static final Pattern HASHTAG = Pattern.compile("#([\\p{L}\\p{M}\\p{N}_]+)");

    private Hashtags() {}

    public static List<String> extract(String caption) {
        if (caption == null || caption.isEmpty()) return List.of();
        String text = Normalizer.normalize(caption, Normalizer.Form.NFKC);
        Set<String> tags = new LinkedHashSet<>();
        Matcher matcher = HASHTAG.matcher(text);
        while (matcher.find() && tags.size() < MAX_TAGS) {
            String tag = matcher.group(1).toLowerCase(Locale.ROOT);
            int length = tag.codePointCount(0, tag.length());
            if (length >= MIN_LENGTH && length <= MAX_LENGTH && !onlyUnderscores(tag)) tags.add(tag);
        }
        return new ArrayList<>(tags);
    }

    /** Post topics from the caption: every tag as "tag:x", plus the taxonomy code a tag names. Weight 1 each. */
    public static Map<String, Double> topics(String caption) {
        Map<String, Double> topics = new LinkedHashMap<>();
        for (String tag : extract(caption)) {
            topics.put(TAG_PREFIX + tag, 1.0);
            Topics.fromHashtag(tag).ifPresent(topic -> topics.put(topic, 1.0));
        }
        return topics;
    }

    private static boolean onlyUnderscores(String tag) {
        return tag.chars().allMatch(c -> c == '_');
    }
}
