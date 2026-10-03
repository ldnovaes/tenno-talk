package com.tennotalk.common;

import java.io.IOException;
import java.util.LinkedHashMap;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.MediaType;

import tools.jackson.databind.json.JsonMapper;

/** Same Problem Details shape as GlobalExceptionHandler, for code that runs outside Spring MVC (filters). */
public final class ProblemWriter {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private ProblemWriter() {}

    public static void write(HttpServletResponse response, ErrorCode code, String message) throws IOException {
        response.setStatus(code.status().value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        var body = new LinkedHashMap<String, Object>();
        body.put("type", "about:blank");
        body.put("title", code.status().getReasonPhrase());
        body.put("status", code.status().value());
        body.put("detail", message);
        body.put("code", code.wireName());
        JSON.writeValue(response.getOutputStream(), body);
    }
}
