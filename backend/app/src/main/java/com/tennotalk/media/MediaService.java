package com.tennotalk.media;

import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Semaphore;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

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
    static final Set<String> IMAGES = Set.of("image/jpeg", "image/png", "image/gif", "image/webp");
    static final Set<String> UNCLEANABLE = Set.of("image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence");
    static final Set<String> VIDEOS = Set.of("video/mp4", "video/webm", "video/quicktime", "video/x-matroska", "video/3gpp");
    static final Set<String> BLOCKED = Set.of("text/html", "application/xhtml+xml", "image/svg+xml", "application/javascript",
            "text/javascript", "application/x-msdownload", "application/x-sh", "application/x-executable");
    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/jpeg", "jpg", "image/png", "png", "image/gif", "gif", "image/webp", "webp",
            "video/mp4", "mp4", "video/webm", "webm", "video/quicktime", "mov");
    /** Photos are cleaned in memory (PLAN.md §38): bytes and decoded pixels both have a ceiling. */
    static final long MAX_IMAGE_BYTES = 25L * 1024 * 1024;
    static final long MAX_PIXELS = 24_000_000L;
    static final int MAX_SIDE = 12_000;
    /** Per account (PLAN.md §38): a full disk would take the database and the neighbours down. */
    static final long DAILY_QUOTA = 2L * 1024 * 1024 * 1024;
    static final long TOTAL_QUOTA = 10L * 1024 * 1024 * 1024;
    static final Duration ORPHAN_AFTER = Duration.ofDays(1);
    static final Duration STORY_MEDIA_AFTER = Duration.ofDays(2);
    private static final DateTimeFormatter FOLDER = DateTimeFormatter.ofPattern("yyyy/MM").withZone(ZoneOffset.UTC);

    private final MediaRepository repository;
    private final MediaStorage storage;
    private final Tika tika = new Tika();
    private final Clock clock;
    /** One decode at a time: a 24 MP photo already takes ~100 MB of heap. */
    private final Semaphore decoding = new Semaphore(1, true);

    public MediaService(MediaRepository repository, MediaStorage storage, Clock clock) {
        this.repository = repository;
        this.storage = storage;
        this.clock = clock;
    }

    public MediaRow upload(UUID owner, MultipartFile file) throws IOException {
        if (file.isEmpty()) throw ApiException.validation("The file is empty.");
        requireQuota(owner, file.getSize());
        String name = sanitize(file.getOriginalFilename());
        String mime;
        try (InputStream in = file.getInputStream()) {
            mime = tika.detect(in, name);
        }
        if (BLOCKED.contains(mime)) throw ApiException.validation("This type of file is not allowed.");
        // HEIC/HEIF metadata can't be removed here (PLAN.md §29): never stored as it came.
        if (UNCLEANABLE.contains(mime)) throw ApiException.validation("This photo format isn't supported. Use JPEG, PNG, WebP or GIF.");
        String kind = IMAGES.contains(mime) ? "image" : VIDEOS.contains(mime) ? "video" : mime.startsWith("audio/") ? "audio" : "file";

        UUID id = Ids.newId();
        String path = FOLDER.format(clock.instant()) + "/" + id + "." + EXTENSIONS.getOrDefault(mime, "bin");
        Integer width = null;
        Integer height = null;
        long size = file.getSize();
        if ("image".equals(kind) && (mime.equals("image/jpeg") || mime.equals("image/png"))) {
            CleanImage cleaned = clean(readImage(file), mime.equals("image/jpeg") ? "jpg" : "png");
            width = cleaned.width();
            height = cleaned.height();
            storage.store(path, new ByteArrayInputStream(cleaned.bytes()));
            size = cleaned.bytes().length;
        } else if (mime.equals("image/webp") || mime.equals("image/gif")) {
            byte[] original = readImage(file);
            byte[] cleaned;
            try {
                cleaned = mime.equals("image/webp") ? ImageMetadata.stripWebp(original) : ImageMetadata.stripGif(original);
            } catch (IOException damaged) {
                throw ApiException.validation("This image is damaged or not supported.");
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

    private void requireQuota(UUID owner, long incoming) {
        MediaRepository.Usage usage = repository.usage(owner, clock.instant().minus(Duration.ofDays(1)));
        if (usage.lastDay() + incoming > DAILY_QUOTA) {
            throw ApiException.validation("You reached today's upload limit (2 GB). Try again tomorrow.");
        }
        if (usage.total() + incoming > TOTAL_QUOTA) {
            throw ApiException.validation("Your account reached its storage limit (10 GB).");
        }
    }

    /** Removes files nobody uses (PLAN.md §38); the rows are gone (committed) before the bytes. */
    public int deleteUnused() {
        List<String> paths = repository.deleteUnused(clock.instant().minus(ORPHAN_AFTER), clock.instant().minus(STORY_MEDIA_AFTER), 500);
        paths.forEach(storage::delete);
        return paths.size();
    }

    record CleanImage(byte[] bytes, Integer width, Integer height) {}

    private static byte[] readImage(MultipartFile file) throws IOException {
        if (file.getSize() > MAX_IMAGE_BYTES) throw ApiException.validation("Photos can be at most 25 MB.");
        return file.getBytes();
    }

    /** Re-encodes the pixels only (dropping EXIF, location and device), checking the size before decoding. */
    private CleanImage clean(byte[] original, String format) {
        decoding.acquireUninterruptibly();
        try {
            return stripMetadata(original, format);
        } catch (IOException damaged) {
            // Unreadable pixels also mean the metadata can't be removed: never store it as is.
            throw ApiException.validation("This image is damaged or not supported.");
        } finally {
            decoding.release();
        }
    }

    static CleanImage stripMetadata(byte[] original, String format) throws IOException {
        BufferedImage image;
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(original))) {
            Iterator<ImageReader> readers = in == null ? null : ImageIO.getImageReaders(in);
            if (readers == null || !readers.hasNext()) return new CleanImage(original, null, null);
            ImageReader reader = readers.next();
            try {
                reader.setInput(in, true, true);
                // The header is read alone first: a few KB can declare billions of pixels.
                requireReasonableSize(reader.getWidth(0), reader.getHeight(0));
                image = reader.read(0);
            } finally {
                reader.dispose();
            }
        }
        if ("jpg".equals(format) && image.getColorModel().hasAlpha()) {
            BufferedImage rgb = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
            rgb.createGraphics().drawImage(image, 0, 0, null);
            image = rgb;
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (!ImageIO.write(image, format, out)) return new CleanImage(original, image.getWidth(), image.getHeight());
        return new CleanImage(out.toByteArray(), image.getWidth(), image.getHeight());
    }

    static void requireReasonableSize(int width, int height) {
        if (width <= 0 || height <= 0 || width > MAX_SIDE || height > MAX_SIDE || (long) width * height > MAX_PIXELS) {
            throw ApiException.validation("This photo is too large. Use one up to 24 megapixels.");
        }
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
