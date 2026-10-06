package com.tennotalk.moderation;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;

import com.tennotalk.support.IntegrationTest;

import tools.jackson.databind.JsonNode;

import static com.tennotalk.support.TestData.asAdmin;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Reports (PLAN.md §31): every reason, one open report per person and target even under double taps, review. */
class ModerationEdgesIT extends IntegrationTest {

    @Autowired
    ReportService reports;

    private UUID reporter;
    private UUID target;
    private UUID admin;

    @BeforeEach
    void people() {
        reporter = data.user("ana", "es-ES");
        target = data.user("spammer", "en-US");
        admin = data.user("admin", "en-US");
        data.makeAdmin(admin);
    }

    private long openReports() {
        return jdbc.sql("SELECT count(*) FROM reports WHERE status = 'open'").query(Long.class).single();
    }

    @ParameterizedTest(name = "{0}")
    @ValueSource(strings = {"spam", "harassment", "hate", "sexual", "violence", "other"})
    void everyReasonIsAccepted(String reason) throws Exception {
        api.post(reporter, "/api/reports", Map.of("targetKind", "user", "targetId", target, "reason", reason))
                .andExpect(status().is2xxSuccessful());
        assertThat(jdbc.sql("SELECT reason FROM reports").query(String.class).single()).isEqualTo(reason);
    }

    @Test
    void aDoubleTapCreatesOneOpenReport() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(16);
        try {
            for (int round = 0; round < 20; round++) {
                jdbc.sql("DELETE FROM reports").update();
                CountDownLatch start = new CountDownLatch(1);
                List<Future<ReportService.ReportDto>> tasks = new ArrayList<>();
                for (int n = 0; n < 16; n++) {
                    tasks.add(pool.submit(() -> {
                        start.await();
                        return reports.report(reporter, "user", target, "spam");
                    }));
                }
                start.countDown();
                List<UUID> ids = new ArrayList<>();
                for (Future<ReportService.ReportDto> task : tasks) ids.add(task.get(30, TimeUnit.SECONDS).id());
                assertThat(openReports()).as("round " + round).isOne();
                assertThat(ids).as("every tap gets the same report").containsOnly(ids.getFirst());
            }
        } finally {
            pool.shutdown();
        }
    }

    @ParameterizedTest(name = "resolved as {0}, then reported again")
    @CsvSource({"reviewed", "dismissed"})
    void aResolvedReportLeavesTheQueueAndANewOneCanBeOpened(String resolution) throws Exception {
        String id = api.postOk(reporter, "/api/reports", Map.of("targetKind", "user", "targetId", target, "reason", "spam"))
                .get("id").asString();
        api.patch(admin, "/api/admin/reports/" + id, Map.of("status", resolution)).andReturn();
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/admin/reports/" + id)
                        .with(asAdmin(admin))
                        .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
                        .contentType("application/json").content("{\"status\":\"" + resolution + "\"}"))
                .andExpect(status().isOk());

        JsonNode queue = json.readTree(mvc.perform(get("/api/admin/reports").with(asAdmin(admin)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(queue.size()).as("open queue (the default)").isZero();
        JsonNode resolved = json.readTree(mvc.perform(get("/api/admin/reports?status=" + resolution).with(asAdmin(admin)))
                .andReturn().getResponse().getContentAsString());
        assertThat(resolved.size()).isOne();

        api.post(reporter, "/api/reports", Map.of("targetKind", "user", "targetId", target, "reason", "harassment"))
                .andExpect(status().is2xxSuccessful());
        assertThat(openReports()).as("it happened again: a new report").isOne();
    }

    @Test
    void differentPeopleOrTargetsEachHaveTheirOwnReport() throws Exception {
        UUID other = data.user("other", "en-US");
        reports.report(reporter, "user", target, "spam");
        reports.report(other, "user", target, "spam");
        reports.report(reporter, "user", other, "spam");
        assertThat(openReports()).isEqualTo(3);
    }
}
