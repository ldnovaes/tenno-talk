package com.tennotalk.discovery;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.auth.AppPrincipal;
import com.tennotalk.common.Ids;
import com.tennotalk.common.PageDto;
import com.tennotalk.discovery.DiscoverDtos.EventBatch;
import com.tennotalk.feed.FeedDtos.PostDto;

@RestController
@RequestMapping("/api/discover")
public class DiscoverController {

    private final DiscoverService discover;
    private final InteractionRecorder recorder;

    public DiscoverController(DiscoverService discover, InteractionRecorder recorder) {
        this.discover = discover;
        this.recorder = recorder;
    }

    @GetMapping
    public PageDto<PostDto> page(@AuthenticationPrincipal AppPrincipal me, @RequestParam(required = false) String cursor) {
        return discover.page(me.userId(), cursor);
    }

    @PostMapping("/events")
    public ResponseEntity<Void> events(@AuthenticationPrincipal AppPrincipal me, @Valid @RequestBody EventBatch body) {
        recorder.recordFromClient(me.userId(), body.events());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/hidden/posts/{postId}")
    public ResponseEntity<Void> unhidePost(@AuthenticationPrincipal AppPrincipal me, @PathVariable String postId) {
        recorder.unhidePost(me.userId(), Ids.parse(postId));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/hidden/authors/{authorId}")
    public ResponseEntity<Void> unhideAuthor(@AuthenticationPrincipal AppPrincipal me, @PathVariable String authorId) {
        recorder.unhideAuthor(me.userId(), Ids.parse(authorId));
        return ResponseEntity.noContent().build();
    }
}
