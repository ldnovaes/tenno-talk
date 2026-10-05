package com.tennotalk.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;

import com.tennotalk.support.IntegrationTest;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Every fixed-delay task holds at most one scheduler thread, so a pool at least as large as the number of tasks
 * means none waits for another: the realtime dispatch (badges, live messages) keeps its 150 ms rhythm even while
 * the AI workers spend a minute on a provider call.
 */
class SchedulingPoolIT extends IntegrationTest {

    @Autowired
    ScheduledAnnotationBeanPostProcessor scheduling;

    @Value("${spring.task.scheduling.pool.size}")
    int poolSize;

    @Test
    void everyScheduledTaskHasItsOwnThread() {
        assertThat(scheduling.getScheduledTasks()).hasSizeLessThanOrEqualTo(poolSize);
    }
}
