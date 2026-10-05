package com.tennotalk.recommender;

import java.util.Map;

/**
 * Immutable sparse vector of named weights (topics, "tag:*" hashtags, countries).
 * Only finite, non-zero weights are kept, so every operation is total.
 */
public final class SparseVector {

    public static final SparseVector EMPTY = new SparseVector(Map.of());

    private final Map<String, Double> weights;
    private final double norm;

    private SparseVector(Map<String, Double> weights) {
        this.weights = weights;
        double sum = 0;
        for (double weight : weights.values()) sum += weight * weight;
        this.norm = Math.sqrt(sum);
    }

    public static SparseVector of(Map<String, ? extends Number> weights) {
        Map<String, Double> clean = Safe.finiteMap(weights);
        return clean.isEmpty() ? EMPTY : new SparseVector(clean);
    }

    public double get(String key) {
        Double weight = key == null ? null : weights.get(key);
        return weight == null ? 0 : weight;
    }

    public Map<String, Double> weights() {
        return weights;
    }

    public boolean isEmpty() {
        return weights.isEmpty();
    }

    public double norm() {
        return norm;
    }

    public double dot(SparseVector other) {
        if (other == null || isEmpty() || other.isEmpty()) return 0;
        SparseVector small = weights.size() <= other.weights.size() ? this : other;
        SparseVector large = small == this ? other : this;
        double sum = 0;
        for (Map.Entry<String, Double> entry : small.weights.entrySet()) sum += entry.getValue() * large.get(entry.getKey());
        return sum;
    }

    /** Cosine similarity in [-1, 1]; 0 when either side is empty. */
    public double cosine(SparseVector other) {
        if (other == null || norm == 0 || other.norm == 0) return 0;
        double cosine = dot(other) / (norm * other.norm);
        if (!Double.isFinite(cosine)) return 0;
        return Math.max(-1, Math.min(1, cosine));
    }

    @Override
    public boolean equals(Object other) {
        return other instanceof SparseVector vector && weights.equals(vector.weights);
    }

    @Override
    public int hashCode() {
        return weights.hashCode();
    }

    @Override
    public String toString() {
        return weights.toString();
    }
}
