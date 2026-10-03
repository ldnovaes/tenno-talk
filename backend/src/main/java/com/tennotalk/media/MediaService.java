package com.tennotalk.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import javax.imageio.ImageIO;

import org.apache.tika.Tika;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.tennotalk.common.ApiException;
import com.tennotalk.common.Ids;

/**
 * Upload validation (PLAN.md §29): the real type comes from the bytes (Apache Tika),
 * never from the client; photos lose EXIF/GPS; nothing is executable or inline-scriptable.
 */
@Service
public class MediaService {

    /** Raster images shown inline; SVG is excluded (it can carry scripts). */
    static final Set<String> IMAGES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp", "image/heic", "image/heif");
    static final Set<String> VIDEOS = Set.of("video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/3gpp");
    static final Set<String> BLOCKED = Set.of("text/html", "application/xhtml+xml", "image/svg+xml", "application/javascript",
            "text/javascript", "application/x-msdownload", "application/x-sh", "application/x-executable");
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/gif", "gif", "image/webp", "webp",
            "video/mp4", "mp4", "video/webm", "webm", "video/quicktime", "mov");
    private static final DateTimeFormatter FOLDER = DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);

    private final MediaRepository repository;
    private final MediaStorage storage;
    private final Tika tika = new Tika();
    private final Clock clock;

    public MediaService(MediaRepository repository, MediaStorage storage, Clock clock) {
        this.repository = repository;
        this.storage = storage;
        this.clock = clock;
    }

    public MediaRow upload(UUID owner, MultipartFile file) throws IOException {
        if (file.isEmpty()) throw ApiException.validation("The file is empty.");
        String name = sanitize(file.getOriginalFilename());
        String mime;
        try (InputStream in = file.getInputStream()) {
            mime = tika.detect(in, name);
        }
        if (BLOCKED.contains(mime)) throw ApiException.validation("This type of file is not allowed.");
        String kind = IMAGES.contains(mime) ? "image" : VIDEOS.contains(mime) ? "video" : mime.startsWith("audio/") ? "audio" : "file";

        UUID id = Ids.newId();
        String path = FOLDER.format(clock.instant()) + "/" + id + "." + EXTENSIONS.getOrDefault(mime, "bin");
        Integer width = null;
        Integer height = null;
        long size = file.getSize();
        if ("image".equals(kind) && (mime.equals("image/jpeg") || mime.equals("image/png"))) {
            byte[] cleaned = stripMetadata(file.getBytes(), mime.equals("image/jpeg") ? "jpg" : "png");
            BufferedImage image = ImageIO.read(new ByteArrayInputStream(cleaned));
            if (image != null) {
                width = image.getWidth();
                height = image.getHeight();
            }
            storage.store(path, new ByteArrayInputStream(cleaned));
            size = cleaned.length;
        } else {
            try (InputStream in = file.getInputStream()) {
                storage.store(path, in);
            }
        }
        MediaRow row = new MediaRow(id, owner, kind, mime, size, width, height, null, path, name, clock.instant());
        repository.insert(row);
        return row;
    }

    /** Re-encodes the pixels only, dropping EXIF (location, device) and other metadata. */
    static byte[] stripMetadata(byte[] original, String format) throws IOException {
        BufferedImage image = ImageIO.read(new ByteArrayInputStream(original));
        if (image == null) return original;
        if ("jpg".equals(format) && image.getColorModel().hasAlpha()) {
            BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
            rgb.createGraphics().drawImage(image, 0, 0, null);
            image = rgb;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (!ImageIO.write(image, format, out)) return original;
        return out.toByteArray();
    }

    static String sanitize(String name) {
        String base = name == null ? "file" : Path.of(name).getFileName().toString();
        String clean = base.replaceAll("[^\\p{L}\\p{N}._ -]", "_").strip();
        if (clean.isEmpty()) clean = "file";
        return clean.length() > 120 ? clean.substring(clean.length() - 120) : clean;
    }

    public MediaRow requireViewable(UUID viewer, UUID id) {
        MediaRow row = repository.find(id).orElseThrow(() -> ApiException.notFound("File not found."));
        if (!repository.canView(viewer, id)) throw ApiException.notFound("File not found.");
        if (!Files.exists(storage.resolve(row.storagePath()))) throw ApiException.notFound("File not found.");
        return row;
    }

    public Path pathOf(MediaRow row) {
        return storage.resolve(row.storagePath());
    }
}
