package com.tennotalk.chat;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;

import com.tennotalk.common.Languages;

/** Fan-out: one translation per distinct receiving language that differs from the original (PLAN.md §28.2). */
public final class TranslationTargets {

    private TranslationTargets() {}

    public static List<String> compute(String originalLanguage, Collection<String> memberReceivingLanguages) {
        LinkedHashSet<String> targets = new LinkedHashSet<>();
        for (String language : memberReceivingLanguages) {
            if (language != null && !Languages.same(language, originalLanguage)) targets.add(language);
        }
        return List.copyOf(targets);
    }
}
