package com.tennotalk.support;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeoutException;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.tennotalk.translation.ProcessRunner;

import tools.jackson.databind.json.JsonMapper;

/**
 * Stands in for the codex / claude CLIs. Translates deterministically as
 * "[target-base] text" and can simulate every failure of PLAN.md §28.3.
 */
public class FakeProcessRunner implements ProcessRunner {

    public enum Mode { OK, AUTH, QUOTA, TRANSIENT, TIMEOUT, GARBAGE }

    private static final Pattern MESSAGE = Pattern.compile("MESSAGE:\\n<<<\\n(.*)\\n>>>", Pattern.DOTALL);
    private static final Pattern TARGET = Pattern.compile("Translate the MESSAGE into ([^.]+)\\.");
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final Map<String, Mode> modes = new ConcurrentHashMap<>();
    private final Map<String, Boolean> statusOk = new ConcurrentHashMap<>();
    private final List<List<String>> calls = new CopyOnWriteArrayList<>();
    private volatile CountDownLatch loginApproval = new CountDownLatch(1);
    private volatile int loginExit = 0;

    public void reset() {
        modes.clear();
        statusOk.clear();
        calls.clear();
        loginApproval = new CountDownLatch(1);
        loginExit = 0;
    }

    public void mode(String provider, Mode mode) {
        modes.put(provider, mode);
    }

    public void statusOk(String provider, boolean ok) {
        statusOk.put(provider, ok);
    }

    /** Completes the pending device login with the given exit code. */
    public void approveLogin(int exitCode) {
        loginExit = exitCode;
        loginApproval.countDown();
    }

    public List<List<String>> calls() {
        return List.copyOf(calls);
    }

    public long translationCalls(String provider) {
        return calls.stream().filter(c -> c.getFirst().equals(provider) && c.stream().anyMatch(p -> p.contains("MESSAGE:"))).count();
    }

    /** The prompt received by the last translation call of a provider. */
    public String lastPrompt(String provider) {
        List<String> last = null;
        for (List<String> call : calls) {
            if (call.getFirst().equals(provider) && call.stream().anyMatch(p -> p.contains("MESSAGE:"))) last = call;
        }
        return last == null ? null : last.stream().filter(p -> p.contains("MESSAGE:")).findFirst().orElse(null);
    }

    @Override
    public ProcessResult run(List<String> command, Duration timeout) throws IOException, TimeoutException {
        calls.add(List.copyOf(command));
        String provider = command.getFirst();
        String prompt = command.stream().filter(part -> part.contains("MESSAGE:")).findFirst().orElse(null);
        if (prompt == null) {
            // Status check.
            return new ProcessResult(statusOk.getOrDefault(provider, false) ? 0 : 1, "", "Not logged in");
        }
        return switch (modes.getOrDefault(provider, Mode.OK)) {
            case OK -> new ProcessResult(0, answer(provider, prompt), "");
            case AUTH -> new ProcessResult(1, "", "Error: not logged in. Please run /login");
            case QUOTA -> new ProcessResult(1, "", "Error: usage limit reached (429)");
            case TRANSIENT -> new ProcessResult(1, "", "Error: connection reset");
            case TIMEOUT -> throw new TimeoutException("timed out");
            case GARBAGE -> new ProcessResult(0, "I cannot help with that.", "");
        };
    }

    private static String answer(String provider, String prompt) {
        Matcher message = MESSAGE.matcher(prompt);
        Matcher target = TARGET.matcher(prompt);
        String text = message.find() ? message.group(1) : "";
        String language = target.find() ? target.group(1) : "?";
        String natural = "[" + language + "] " + text;
        String literal = "[" + language + " literal] " + text;
        String body = JSON.writeValueAsString(Map.of("natural", natural, "literal", literal));
        if (provider.equals("claude")) {
            return JSON.writeValueAsString(Map.of("type", "result", "is_error", false, "result", body));
        }
        return "codex v1\nthinking...\n" + body + "\n";
    }

    @Override
    public LongRunningProcess start(List<String> command) {
        calls.add(List.copyOf(command));
        CountDownLatch approval = loginApproval;
        List<String> lines = new ArrayList<>();
        lines.add("Starting login...");
        lines.add("Open https://auth.example.com/device and enter the code ABCD-1234");
        BufferedReader reader = new BufferedReader(new StringReader(String.join("\n", lines) + "\n"));
        return new LongRunningProcess() {
            @Override
            public BufferedReader output() {
                return reader;
            }

            @Override
            public int waitFor() throws InterruptedException {
                approval.await();
                return loginExit;
            }

            @Override
            public void destroy() {
                approval.countDown();
            }
        };
    }
}
