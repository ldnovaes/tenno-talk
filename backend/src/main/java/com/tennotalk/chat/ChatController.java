package com.tennotalk.chat;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.auth.AppPrincipal;
import com.tennotalk.chat.ChatDtos.ConversationDto;
import com.tennotalk.chat.ChatDtos.MessageDto;
import com.tennotalk.chat.ChatInputs.CreateGroup;
import com.tennotalk.chat.ChatInputs.Direct;
import com.tennotalk.chat.ChatInputs.Forward;
import com.tennotalk.chat.ChatInputs.MarkRead;
import com.tennotalk.chat.ChatInputs.Mute;
import com.tennotalk.chat.ChatInputs.React;
import com.tennotalk.chat.ChatInputs.SendMessage;
import com.tennotalk.common.Ids;
import com.tennotalk.common.PageDto;

@RestController
@RequestMapping("/api")
public class ChatController {

    private final ChatService chat;

    public ChatController(ChatService chat) {
        this.chat = chat;
    }

    @GetMapping("/conversations")
    public List<ConversationDto> conversations(@AuthenticationPrincipal AppPrincipal me) {
        return chat.conversations(me.userId());
    }

    @GetMapping("/conversations/{id}")
    public ConversationDto conversation(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id) {
        return chat.conversation(me.userId(), Ids.parse(id));
    }

    @GetMapping("/conversations/{id}/messages")
    public PageDto<MessageDto> messages(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id,
            @RequestParam(required = false) String cursor) {
        return chat.messages(me.userId(), Ids.parse(id), cursor);
    }

    @PostMapping("/conversations/{id}/messages")
    public MessageDto send(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id, @Valid @RequestBody SendMessage body) {
        return chat.send(me.userId(), Ids.parse(id), body);
    }

    @PostMapping("/conversations/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id, @Valid @RequestBody MarkRead body) {
        chat.markRead(me.userId(), Ids.parse(id), body.messageId());
    }

    @PutMapping("/conversations/{id}/mute")
    public ConversationDto mute(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id, @RequestBody Mute body) {
        return chat.mute(me.userId(), Ids.parse(id), body.muted());
    }

    @PostMapping("/conversations/direct")
    public ConversationDto direct(@AuthenticationPrincipal AppPrincipal me, @Valid @RequestBody Direct body) {
        return chat.direct(me.userId(), body.userId());
    }

    @PostMapping("/conversations/groups")
    public ConversationDto createGroup(@AuthenticationPrincipal AppPrincipal me, @Valid @RequestBody CreateGroup body) {
        return chat.createGroup(me.userId(), body.title(), body.memberIds());
    }

    @PostMapping("/messages/{id}/reactions")
    public MessageDto react(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id, @Valid @RequestBody React body) {
        return chat.react(me.userId(), Ids.parse(id), body.emoji());
    }

    @PostMapping("/messages/{id}/forward")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void forward(@AuthenticationPrincipal AppPrincipal me, @PathVariable String id, @Valid @RequestBody Forward body) {
        chat.forward(me.userId(), Ids.parse(id), body.conversationIds());
    }
}
