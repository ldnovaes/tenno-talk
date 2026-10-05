package com.tennotalk.recommender.learning;

import static com.tennotalk.recommender.Fixtures.id;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.tennotalk.recommender.SparseVector;

class NeighborsTest {

    private final SparseVector travel = SparseVector.of(Map.of("travel", 1.0));

    @Test
    void mostSimilarFirstSkippingSelfAndDissimilarPeople() {
        Map<UUID, SparseVector> everyone = new HashMap<>();
        everyone.put(id(1), travel);
        everyone.put(id(2), SparseVector.of(Map.of("travel", 1.0, "food", 1.0)));
        everyone.put(id(3), SparseVector.of(Map.of("travel", 1.0)));
        everyone.put(id(4), SparseVector.of(Map.of("food", 1.0)));
        everyone.put(id(5), SparseVector.of(Map.of("travel", -1.0)));
        everyone.put(null, travel);

        assertThat(Neighbors.nearest(id(1), travel, everyone, 10, 0.1)).extracting(Neighbors.Neighbor::id).containsExactly(id(3), id(2));
        assertThat(Neighbors.nearest(id(1), travel, everyone, 1, 0.1)).extracting(Neighbors.Neighbor::id).containsExactly(id(3));
        assertThat(Neighbors.nearest(id(1), travel, everyone, 10, 0.9)).extracting(Neighbors.Neighbor::id).containsExactly(id(3));
    }

    @Test
    void boundariesAreInclusive() {
        SparseVector half = SparseVector.of(Map.of("travel", 1.0, "food", Math.sqrt(3))); // cosine with travel = 0.5
        Map<UUID, SparseVector> everyone = Map.of(id(2), half, id(3), travel);
        assertThat(Neighbors.nearest(id(1), travel, everyone, 2, 0.5)).hasSize(2);
        assertThat(Neighbors.nearest(id(1), travel, everyone, 1, 0.5)).extracting(Neighbors.Neighbor::id).containsExactly(id(3));
        assertThat(Neighbors.nearest(id(1), travel, Map.of(id(2), SparseVector.of(Map.of("food", 1.0))), 3, 0)).isEmpty();
        assertThat(Neighbors.nearest(id(1), travel, Map.of(id(2), travel), 1, 0)).hasSize(1);
    }

    @Test
    void degenerateInputsGiveNobody() {
        assertThat(Neighbors.nearest(null, travel, Map.of(id(2), travel), 3, 0)).isEmpty();
        assertThat(Neighbors.nearest(id(1), SparseVector.EMPTY, Map.of(id(2), travel), 3, 0)).isEmpty();
        assertThat(Neighbors.nearest(id(1), travel, null, 3, 0)).isEmpty();
        assertThat(Neighbors.nearest(id(1), travel, Map.of(id(2), travel), 0, 0)).isEmpty();
        assertThat(Neighbors.nearest(id(1), null, Map.of(id(2), travel), 3, 0)).isEmpty();
    }
}
