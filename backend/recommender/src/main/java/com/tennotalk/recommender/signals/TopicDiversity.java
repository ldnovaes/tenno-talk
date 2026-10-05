package com.tennotalk.recommender.signals;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.tennotalk.recommender.RankContext;
import com.tennotalk.recommender.Ranked;
import com.tennotalk.recommender.RerankDecorator;
import com.tennotalk.recommender.Reranker;
import com.tennotalk.recommender.SparseVector;

/**
 * Light MMR (maximal marginal relevance): among the next {@value #WINDOW} posts, pick the one whose score,
 * minus {@code penalty} × its similarity to the last {@value #MEMORY} picks, is highest. Keeps a strong
 * interest from turning the feed into a single topic, without moving any post far from its place.
 */
public final class TopicDiversity extends RerankDecorator {

    static final int WINDOW = 5;
    static final int MEMORY = 3;
    /** Values closer than this are a tie, and ties keep the incoming order: floating-point noise never reorders. */
    static final double TIE = 1e-9;

    private final double penalty;

    public TopicDiversity(Reranker inner, double penalty) {
        super(inner, "topic-diversity");
        this.penalty = Double.isFinite(penalty) ? Math.max(0, penalty) : 0;
    }

    @Override
    protected List<Ranked> reorder(RankContext context, List<Ranked> ranked) {
        if (penalty == 0) return ranked;
        // Cosine runs ~WINDOW × MEMORY times per post: encode the vectors once so each one is a merge of int arrays.
        Map<String, Integer> dictionary = new HashMap<>();
        List<Unit> pending = new ArrayList<>(ranked.size());
        for (Ranked item : ranked) pending.add(Unit.encode(item, dictionary));
        List<Unit> placed = new ArrayList<>(ranked.size());
        while (!pending.isEmpty()) {
            int best = 0;
            double bestValue = Double.NEGATIVE_INFINITY;
            for (int i = 0; i < Math.min(WINDOW, pending.size()); i++) {
                double value = pending.get(i).ranked.score() - penalty * similarityToRecent(pending.get(i), placed);
                if (value > bestValue + TIE) {
                    bestValue = value;
                    best = i;
                }
            }
            placed.add(pending.remove(best));
        }
        List<Ranked> result = new ArrayList<>(placed.size());
        for (Unit unit : placed) result.add(unit.ranked);
        return result;
    }

    private static double similarityToRecent(Unit candidate, List<Unit> placed) {
        double max = 0;
        for (int i = Math.max(0, placed.size() - MEMORY); i < placed.size(); i++) max = Math.max(max, candidate.cosine(placed.get(i)));
        return max;
    }

    /** A ranked post with its topics as unit-length sparse arrays sorted by key id. */
    private record Unit(Ranked ranked, int[] keys, double[] values) {

        static Unit encode(Ranked ranked, Map<String, Integer> dictionary) {
            SparseVector topics = ranked.candidate().topics();
            int size = topics.weights().size();
            int[] keys = new int[size];
            double[] values = new double[size];
            double norm = topics.norm();
            int n = 0;
            for (Map.Entry<String, Double> entry : topics.weights().entrySet()) {
                int key = dictionary.computeIfAbsent(entry.getKey(), k -> dictionary.size());
                double value = norm == 0 ? 0 : entry.getValue() / norm;
                int at = n++;
                while (at > 0 && keys[at - 1] > key) { // insertion sort: posts have few topics
                    keys[at] = keys[at - 1];
                    values[at] = values[at - 1];
                    at--;
                }
                keys[at] = key;
                values[at] = value;
            }
            return new Unit(ranked, keys, values);
        }

        double cosine(Unit other) {
            double sum = 0;
            int i = 0;
            int j = 0;
            while (i < keys.length && j < other.keys.length) {
                if (keys[i] == other.keys[j]) sum += values[i++] * other.values[j++];
                else if (keys[i] < other.keys[j]) i++;
                else j++;
            }
            return Double.isFinite(sum) ? Math.max(-1, Math.min(1, sum)) : 0;
        }
    }
}
