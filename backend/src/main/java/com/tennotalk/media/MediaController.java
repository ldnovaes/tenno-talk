package com.tennotalk.media;

import java.io.IOException;

import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.tennotalk.auth.AppPrincipal;
import com.tennotalk.chat.ChatDtos.MediaAttachmentDto;
import com.tennotalk.common.Ids;

@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final MediaService media;

    public MediaController(MediaService media) {
        this.media = media;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public MediaAttachmentDto upload(@AuthenticationPrincipal AppPrincipal me, @RequestParam("file") MultipartFile file) throws IOException {
        return media.upload(me.userId(), file).toDto();
    }

    /** Authorized download; Spring answers Range requests (video seeking) with 206. */
    @GetMapping("/{id}")
    public ResponseEntity<Resource> download(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id) {
        MediaRow row = media.requireViewable(me.userId(), Ids.parse(id));
        boolean inline = "image".equals(row.kind()) || "video".equals(row.kind()) || "audio".equals(row.kind());
        ContentDisposition disposition = (inline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(row.originalName(), java.nio.charset.StandardCharsets.UTF_8)
                .build();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(row.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header("X-Content-Type-Options", "nosniff")
                .cacheControl(CacheControl.noCache().cachePrivate())
                .body(new FileSystemResource(media.pathOf(row)));
    }
}
