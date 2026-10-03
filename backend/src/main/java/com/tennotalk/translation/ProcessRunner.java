package com.tennotalk.translation;

import java.io.BufferedReader;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeoutException;

/** Runs the AI CLIs (codex / claude). Swapped by a fake in tests. */
public interface ProcessRunner {

    record ProcessResult(int exitCode, String stdout, String stderr) {}

    /** A process that keeps running (interactive login flows). */
    interface LongRunningProcess {
        BufferedReader output();

        int waitFor() throws InterruptedException;

        void destroy();
    }

    ProcessResult run(List<String> command, Duration timeout) throws IOException, TimeoutException;

    LongRunningProcess start(List<String> command) throws IOException;
}
