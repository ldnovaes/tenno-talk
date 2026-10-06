package com.tennotalk.media;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/**
 * Removes location and device metadata from formats that are kept as they are (PLAN.md §29): re-encoding a WebP or
 * a GIF would cost quality or the animation, so only the metadata blocks go. Malformed input is an IOException:
 * a file that can't be parsed can't be cleaned, so it is never stored.
 */
final class ImageMetadata {

    private ImageMetadata() {}

    // ---- WebP: RIFF container; drop the EXIF and XMP chunks and their flags in VP8X ----

    private static final Set<String> WEBP_METADATA = Set.of("EXIF", "XMP ");
    private static final int VP8X_EXIF = 0x08;
    private static final int VP8X_XMP = 0x04;

    static byte[] stripWebp(byte[] original) throws IOException {
        ByteBuffer in = ByteBuffer.wrap(original).order(ByteOrder.LITTLE_ENDIAN);
        if (original.length < 12 || !ascii(original, 0, 4).equals("RIFF") || !ascii(original, 8, 4).equals("WEBP"))
            throw new IOException("Not a WebP");
        ByteArrayOutputStream body = new ByteArrayOutputStream(original.length);
        body.write(original, 8, 4);
        int position = 12;
        while (position < original.length) {
            if (position + 8 > original.length) throw new IOException("Truncated chunk header");
            String fourcc = ascii(original, position, 4);
            long size = Integer.toUnsignedLong(in.getInt(position + 4));
            long padded = size + (size & 1);
            if (position + 8 + size > original.length) throw new IOException("Truncated chunk");
            if (!WEBP_METADATA.contains(fourcc)) {
                int length = (int) Math.min(8 + padded, original.length - position);
                byte[] copy = java.util.Arrays.copyOfRange(original, position, position + length);
                if (fourcc.equals("VP8X") && size >= 1) copy[8] = (byte) (copy[8] & ~(VP8X_EXIF | VP8X_XMP));
                body.write(copy);
            }
            position += (int) (8 + padded);
        }
        byte[] content = body.toByteArray();
        ByteBuffer out = ByteBuffer.allocate(8 + content.length).order(ByteOrder.LITTLE_ENDIAN);
        out.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(content.length).put(content);
        return out.array();
    }

    // ---- GIF: drop comment extensions and application extensions except the animation loop ----

    private static final Set<String> GIF_KEPT_APPLICATIONS = Set.of("NETSCAPE2.0", "ANIMEXTS1.0");

    static byte[] stripGif(byte[] original) throws IOException {
        if (original.length < 13 || !ascii(original, 0, 3).equals("GIF")) throw new IOException("Not a GIF");
        int flags = original[10] & 0xFF;
        int position = 13 + ((flags & 0x80) != 0 ? 3 * (1 << ((flags & 0x07) + 1)) : 0);
        if (position > original.length) throw new IOException("Truncated color table");
        ByteArrayOutputStream out = new ByteArrayOutputStream(original.length);
        out.write(original, 0, position);
        while (true) {
            if (position >= original.length) throw new IOException("Missing trailer");
            int introducer = original[position] & 0xFF;
            if (introducer == 0x3B) {
                out.write(0x3B);
                return out.toByteArray();
            }
            int start = position;
            if (introducer == 0x21) {
                if (position + 1 >= original.length) throw new IOException("Truncated extension");
                int label = original[position + 1] & 0xFF;
                position = skipSubBlocks(original, position + 2);
                boolean drop = label == 0xFE
                        || (label == 0xFF && !GIF_KEPT_APPLICATIONS.contains(applicationId(original, start + 2)));
                if (!drop) out.write(original, start, position - start);
            } else if (introducer == 0x2C) {
                if (position + 10 > original.length) throw new IOException("Truncated image descriptor");
                int imageFlags = original[position + 9] & 0xFF;
                position += 10 + ((imageFlags & 0x80) != 0 ? 3 * (1 << ((imageFlags & 0x07) + 1)) : 0);
                position = skipSubBlocks(original, position + 1); // LZW minimum code size, then data sub-blocks
                out.write(original, start, position - start);
            } else {
                throw new IOException("Unknown GIF block");
            }
        }
    }

    /** Returns the position after a sequence of sub-blocks ending with a zero-length block. */
    private static int skipSubBlocks(byte[] bytes, int position) throws IOException {
        while (true) {
            if (position >= bytes.length) throw new IOException("Truncated sub-blocks");
            int length = bytes[position] & 0xFF;
            position += 1 + length;
            if (length == 0) return position;
        }
    }

    private static String applicationId(byte[] bytes, int blockStart) {
        int length = bytes[blockStart] & 0xFF;
        return length >= 11 && blockStart + 12 <= bytes.length ? ascii(bytes, blockStart + 1, 11) : "";
    }

    private static String ascii(byte[] bytes, int offset, int length) {
        return new String(bytes, offset, length, StandardCharsets.US_ASCII);
    }
}
