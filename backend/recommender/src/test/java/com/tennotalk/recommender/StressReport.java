package com.tennotalk.recommender;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Samples measure rank() only; wall throughput includes fixture construction and assertions. */
final class StressReport {
    private final List<Long> samples = new ArrayList<>();
    private final long started = System.nanoTime();
    private long evaluations;
    private int fallbacks;
    private int degraded;

    void add(RankRequest request, Ranking ranking, long nanos) {
        samples.add(nanos);
        evaluations += request.candidates().size();
        if (ranking.diagnostics().usedFallback()) fallbacks++;
        if (!ranking.diagnostics().disabled().isEmpty() || !ranking.diagnostics().slow().isEmpty()
                || !ranking.diagnostics().failures().isEmpty()) degraded++;
    }

    double fallbackRate() { return fallbacks / (double) samples.size(); }
    double degradedRate() { return degraded / (double) samples.size(); }

    double percentile(double fraction) {
        long[] sorted = samples.stream().mapToLong(Long::longValue).toArray();
        Arrays.sort(sorted);
        return sorted[(int) Math.ceil(fraction * sorted.length) - 1] / 1_000_000.0;
    }

    void write(String name, long seed, int catalogSize) throws IOException {
        double seconds = (System.nanoTime() - started) / 1_000_000_000.0;
        String json = String.format(Locale.ROOT, """
                {
                  "scenario": "%s", "seed": %d, "catalogPosts": %d,
                  "sessions": %d, "candidateEvaluations": %d,
                  "p50Ms": %.3f, "p95Ms": %.3f, "p99Ms": %.3f,
                  "wallSeconds": %.3f, "sessionsPerSecondIncludingChecks": %.3f,
                  "fallbacks": %d, "degradedSessions": %d,
                  "availableProcessors": %d, "maxHeapBytes": %d
                }
                """, name, seed, catalogSize, samples.size(), evaluations, percentile(.5), percentile(.95), percentile(.99),
                seconds, samples.size() / seconds, fallbacks, degraded,
                Runtime.getRuntime().availableProcessors(), Runtime.getRuntime().maxMemory());
        Path directory = Path.of("target", "recommender-stress");
        Files.createDirectories(directory);
        Files.writeString(directory.resolve(name + "-" + seed + ".json"), json);
        System.out.println("[recommender-stress] " + json);
    }
}
