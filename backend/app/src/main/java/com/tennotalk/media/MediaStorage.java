package com.tennotalk.media;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;

/** Where media bytes live (local disk on the VPS; S3/MinIO later, PLAN.md §29). */
public interface MediaStorage {

    /** Stores the stream and returns the relative storage path. */
    String store(String relativePath, InputStream content) throws IOException;

    Path resolve(String relativePath);

    void delete(String relativePath);
}
