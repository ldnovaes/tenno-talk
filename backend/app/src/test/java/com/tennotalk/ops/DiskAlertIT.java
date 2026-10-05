package com.tennotalk.ops;

import org.junit.jupiter.api.Test;
import org.springframework.test.context.TestPropertySource;

import com.tennotalk.support.IntegrationTest;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Media has no product limit (R15): the public health check must fail before the disk fills up. */
@TestPropertySource(properties = "management.health.diskspace.threshold=1000TB")
class DiskAlertIT extends IntegrationTest {

    @Test
    void healthIsDownWhenFreeSpaceIsBelowTheThreshold() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.status").value("DOWN"));
    }
}
