package com.tennotalk.common;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Every error leaves the API as Problem Details (PLAN.md §25). */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> handleApi(ApiException exception) {
        return respond(Problems.of(exception.code(), exception.getMessage(), exception.fieldErrors()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> handleInvalid(MethodArgumentNotValidException exception) {
        Map<String, String> fields = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                fields.putIfAbsent(error.getField(), String.valueOf(error.getDefaultMessage())));
        return respond(Problems.of(ErrorCode.VALIDATION, "Some fields are not valid.", fields));
    }

    @ExceptionHandler({
        HttpMessageNotReadableException.class,
        MissingServletRequestParameterException.class,
        MethodArgumentTypeMismatchException.class,
        MissingServletRequestPartException.class,
        MultipartException.class
    })
    ResponseEntity<ProblemDetail> handleBadRequest(Exception exception) {
        return respond(Problems.of(ErrorCode.VALIDATION, "The request is not valid."));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ProblemDetail> handleMethod(HttpRequestMethodNotSupportedException exception) {
        return respond(Problems.of(ErrorCode.VALIDATION, HttpStatus.METHOD_NOT_ALLOWED, "This action is not available here."));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ProblemDetail> handleMediaType(HttpMediaTypeNotSupportedException exception) {
        return respond(Problems.of(ErrorCode.VALIDATION, HttpStatus.UNSUPPORTED_MEDIA_TYPE, "This kind of request body is not accepted here."));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<ProblemDetail> handleDuplicate(DuplicateKeyException exception) {
        return respond(Problems.of(ErrorCode.CONFLICT, "This already exists."));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ProblemDetail> handleTooLarge(MaxUploadSizeExceededException exception) {
        return respond(Problems.of(ErrorCode.VALIDATION, "The file is too large."));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ProblemDetail> handleNoResource(NoResourceFoundException exception) {
        return respond(Problems.of(ErrorCode.NOT_FOUND, "Not found."));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> handleUnexpected(Exception exception) {
        log.error("Unexpected error", exception);
        return respond(Problems.of(ErrorCode.UNKNOWN, "Something went wrong."));
    }

    private static ResponseEntity<ProblemDetail> respond(ProblemDetail problem) {
        return ResponseEntity.status(problem.getStatus()).body(problem);
    }
}
