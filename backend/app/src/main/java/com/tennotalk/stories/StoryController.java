package com.tennotalk.stories;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.auth.AppPrincipal;
import com.tennotalk.common.Ids;
import com.tennotalk.stories.StoryDtos.ReplyResult;
import com.tennotalk.stories.StoryDtos.StoryDto;
import com.tennotalk.stories.StoryDtos.StoryTrayItemDto;

@RestController
@RequestMapping("/api/stories")
public class StoryController {

    public record CreateStory(@NotNull UUID mediaId, @Size(max = 250) String text) {}

    public record React(@NotBlank @Size(max = 16) String emoji, @Size(max = 100) String clientId) {}

    public record Reply(@Size(max = 100) String clientId, @NotBlank @Size(max = 4000) String text) {}

    private final StoryService stories;

    public StoryController(StoryService stories) {
        this.stories = stories;
    }

    @GetMapping("/tray")
    public List<StoryTrayItemDto> tray(@AuthenticationPrincipal AppPrincipal me) {
        return stories.tray(me.userId());
    }

    @GetMapping("/by-user/{id}")
    public List<StoryDto> byUser(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id) {
        return stories.byUser(me.userId(), Ids.parse(id));
    }

    @GetMapping("/{id}")
    public StoryDto get(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id) {
        return stories.get(me.userId(), Ids.parse(id));
    }

    @PostMapping
    public StoryDto create(@AuthenticationPrincipal AppPrincipal me, @Valid @RequestBody CreateStory body) {
        return stories.create(me.userId(), body.mediaId(), body.text());
    }

    @PutMapping("/{id}/view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void view(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id) {
        stories.markViewed(me.userId(), Ids.parse(id));
    }

    @PostMapping("/{id}/reactions")
    public ReplyResult react(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id, @Valid @RequestBody React body) {
        return stories.react(me.userId(), Ids.parse(id), body.emoji(), body.clientId());
    }

    @PostMapping("/{id}/replies")
    public ReplyResult reply(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id, @Valid @RequestBody Reply body) {
        return stories.reply(me.userId(), Ids.parse(id), body.clientId(), body.text());
    }
}
