package com.tennotalk.media;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import com.tennotalk.common.ApiException;
import com.tennotalk.config.TennoProperties;

@Component
public class LocalDiskMediaStorage implements MediaStorage {

    private static final Logger log = LoggerFactory.getLogger(LocalDiskMediaStorage.class);

    private final Path root;

    public LocalDiskMediaStorage(TennoProperties properties) {
        this.root = Path.of(properties.media().root()).toAbsolutePath().normalize();
    }

    @Override
    public String store(String relativePath, InputStream content) throws IOException {
        Path target = resolve(relativePath);
        Files.createDirectories(target.getParent());
        Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
        return relativePath;
    }

    @Override
    public Path resolve(String relativePath) {
        Path target = root.resolve(relativePath).normalize();
        // Never serve or write outside the media root.
        if (!target.startsWith(root)) throw ApiException.forbidden("Invalid media path.");
        return target;
    }

    @Override
    public void delete(String relativePath) {
        try {
            Files.deleteIfExists(resolve(relativePath));
        } catch (IOException exception) {
            log.warn("Could not delete media {}", relativePath, exception);
        }
    }
}
