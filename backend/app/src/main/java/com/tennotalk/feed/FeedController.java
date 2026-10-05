package com.tennotalk.feed;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.auth.AppPrincipal;
import com.tennotalk.common.Ids;
import com.tennotalk.common.PageDto;
import com.tennotalk.feed.FeedDtos.CommentDto;
import com.tennotalk.feed.FeedDtos.PostDto;

@RestController
@RequestMapping("/api")
public class FeedController {

    public record CreatePost(@Size(max = 10) List<UUID> mediaIds, @Size(max = 2200) String caption) {}

    public record AddComment(@Size(max = 2000) String text, @Size(max = 100) String clientId) {}

    private final FeedService feed;

    public FeedController(FeedService feed) {
        this.feed = feed;
    }

    @GetMapping("/feed")
    public PageDto<PostDto> feed(@AuthenticationPrincipal AppPrincipal me, @RequestParam(required = false) String cursor) {
        return feed.feed(me.userId(), cursor);
    }

    @GetMapping("/users/{userId}/posts")
    public PageDto<PostDto> byUser(@AuthenticationPrincipal AppPrincipal me, @PathVariable String userId,
            @RequestParam(required = false) String cursor) {
        return feed.byUser(me.userId(), Ids.parse(userId), cursor);
    }

    @GetMapping("/posts/{id}")
    public PostDto post(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id) {
        return feed.get(me.userId(), Ids.parse(id));
    }

    @PostMapping("/posts")
    public PostDto create(@AuthenticationPrincipal AppPrincipal me, @Valid @RequestBody CreatePost body) {
        return feed.create(me.userId(), body.mediaIds(), body.caption());
    }

    @PutMapping("/posts/{id}/like")
    public PostDto like(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id) {
        return feed.like(me.userId(), Ids.parse(id));
    }

    @DeleteMapping("/posts/{id}/like")
    public PostDto unlike(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id) {
        return feed.unlike(me.userId(), Ids.parse(id));
    }

    @GetMapping("/posts/{id}/comments")
    public List<CommentDto> comments(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id,
        @RequestParam(required = false) String afterId, @RequestParam(required = false) String targetId) {
        return feed.comments(me.userId(), Ids.parse(id), afterId == null ? null : Ids.parse(afterId), targetId == null ? null : Ids.parse(targetId));
    }

    @PostMapping("/posts/{id}/comments")
    public CommentDto comment(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id, @Valid @RequestBody AddComment body) {
        return feed.comment(me.userId(), Ids.parse(id), body.text(), body.clientId());
    }
}
