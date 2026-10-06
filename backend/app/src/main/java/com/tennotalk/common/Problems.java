package com.tennotalk.common;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;

/** Builds Problem Details bodies with the {@code code} and {@code fieldErrors} extensions. */
public final class Problems {

    private Problems() {}

    public static ProblemDetail of(ErrorCode code, String message, Map<String, String> fieldErrors) {
        return of(code, code.status(), message, fieldErrors);
    }

    /** A client error whose HTTP status is more precise than the code's (405, 415). */
    public static ProblemDetail of(ErrorCode code, HttpStatus status, String message) {
        return of(code, status, message, Map.of());
    }

    private static ProblemDetail of(ErrorCode code, HttpStatus status, String message, Map<String, String> fieldErrors) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, message);
        problem.setTitle(status.getReasonPhrase());
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
