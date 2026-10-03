package com.tennotalk.common;

import java.util.Map;

/** Business error rendered as RFC 9457 Problem Details with a stable {@code code}. */
public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final Map<String, String> fieldErrors;

    public ApiException(ErrorCode code, String message) {
        this(code, message, Map.of());
    }

    public ApiException(ErrorCode code, String message, Map<String, String> fieldErrors) {
        super(message);
        this.code = code;
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public ErrorCode code() {
        return code;
    }

    public Map<String, String> fieldErrors() {
        return fieldErrors;
    }

    public static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(ErrorCode.FORBIDDEN, message);
    }

    public static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION, message);
    }

    public static ApiException validation(String message, String field, String problem) {
        return new ApiException(ErrorCode.VALIDATION, message, Map.of(field, problem));
    }

    public static ApiException conflict(String message) {
        return new ApiException(ErrorCode.CONFLICT, message);
    }

    public static ApiException conflict(String message, String field, String problem) {
        return new ApiException(ErrorCode.CONFLICT, message, Map.of(field, problem));
    }

    public static ApiException unauthenticated(String message) {
        return new ApiException(ErrorCode.UNAUTHENTICATED, message);
    }
}
