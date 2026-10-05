package com.tennotalk.recommender.learning;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.tennotalk.recommender.SparseVector;

/**
 * People with interests like someone's (for collaborative filtering). Brute force over the given profiles:
 * O(people) per person, fine for the current scale; an approximate index can replace the caller later.
 */
public final class Neighbors {

    public record Neighbor(UUID id, double similarity) {}

    private Neighbors() {}

    /** The {@code k} most similar people with similarity at least {@code minSimilarity}, most similar first. */
    public static List<Neighbor> nearest(UUID person, SparseVector interests, Map<UUID, SparseVector> everyone, int k,
            double minSimilarity) {
        if (person == null || interests == null || interests.isEmpty() || everyone == null || k <= 0) return List.of();
        List<Neighbor> result = new ArrayList<>();
        for (Map.Entry<UUID, SparseVector> other : everyone.entrySet()) {
            if (other.getKey() == null || other.getKey().equals(person)) continue;
            double similarity = interests.cosine(other.getValue());
            if (similarity >= minSimilarity && similarity > 0) result.add(new Neighbor(other.getKey(), similarity));
        }
        result.sort(Comparator.comparingDouble(Neighbor::similarity).reversed().thenComparing(Neighbor::id));
        return result.size() <= k ? result : List.copyOf(result.subList(0, k));
    }
}
