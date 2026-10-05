package com.tennotalk.common;

import java.util.List;

/** Same shape as the frontend {@code Page<T>}. */
public record PageDto<T>(List<T> items, String nextCursor) {}
