package com.tennotalk.translation;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.springframework.stereotype.Component;

/**
 * Real process runner. Each call runs in an empty temporary directory, so the CLIs
 * have nothing to read or edit (text only, PLAN.md §28.1).
 */
@Component
public class SystemProcessRunner implements ProcessRunner {

    @Override
    public ProcessResult run(List<String> command, Duration timeout) throws IOException, TimeoutException {
        Path workdir = Files.createTempDirectory("tenno-ai-");
        Process process = new ProcessBuilder(command).directory(workdir.toFile()).start();
        process.getOutputStream().close();
        CompletableFuture<String> stdout = CompletableFuture.supplyAsync(() -> read(process.getInputStream()));
        CompletableFuture<String> stderr = CompletableFuture.supplyAsync(() -> read(process.getErrorStream()));
        try {
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                process.destroyForcibly();
                throw new TimeoutException("AI command timed out after " + timeout);
            }
            return new ProcessResult(process.exitValue(), stdout.get(5, TimeUnit.SECONDS), stderr.get(5, TimeUnit.SECONDS));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            throw new IOException("Interrupted", exception);
        } catch (ExecutionException exception) {
            throw new IOException("Could not read the AI output", exception);
        } finally {
            deleteQuietly(workdir);
        }
    }

    @Override
    public LongRunningProcess start(List<String> command) throws IOException {
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
        return new LongRunningProcess() {
            @Override
            public BufferedReader output() {
                return reader;
            }

            @Override
            public int waitFor() throws InterruptedException {
                return process.waitFor();
            }

            @Override
            public void destroy() {
                process.destroyForcibly();
            }
        };
    }

    private static String read(InputStream stream) {
        try (stream) {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException exception) {
            return "";
        }
    }

    private static void deleteQuietly(Path directory) {
        try (var files = Files.walk(directory)) {
            files.sorted(java.util.Comparator.reverseOrder()).forEach(path -> path.toFile().delete());
        } catch (IOException ignored) {
            // Temporary directory: best effort.
        }
    }
}
