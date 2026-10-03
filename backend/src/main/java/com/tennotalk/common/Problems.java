package com.tennotalk.common;

import java.util.Map;

import org.springframework.http.ProblemDetail;

/** Builds Problem Details bodies with the {@code code} and {@code fieldErrors} extensions. */
public final class Problems {

    private Problems() {}

    public static ProblemDetail of(ErrorCode code, String message, Map<String, String> fieldErrors) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(code.status(), message);
        problem.setTitle(code.status().getReasonPhrase());
        problem.setProperty("code", code.wireName());
        if (!fieldErrors.isEmpty()) {
            problem.setProperty("fieldErrors", fieldErrors);
        }
        return problem;
    }

    public static ProblemDetail of(ErrorCode code, String message) {
        return of(code, message, Map.of());
    }
}
