package com.tennotalk.notifications;

import java.util.List;
import java.util.UUID;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.auth.AppPrincipal;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public List<NotificationDto> list(@AuthenticationPrincipal AppPrincipal me, @org.springframework.web.bind.annotation.RequestParam(required = false) UUID beforeId) {
        return notifications.list(me.userId(), beforeId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unread(@AuthenticationPrincipal AppPrincipal me) {
        return Map.of("count", notifications.unread(me.userId()));
    }

    public record ReadItems(@jakarta.validation.constraints.NotNull @jakarta.validation.constraints.Size(max = 100) List<@jakarta.validation.constraints.NotNull UUID> ids) {}

    @PostMapping("/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void read(@AuthenticationPrincipal AppPrincipal me, @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody ReadItems body) {
        notifications.markRead(me.userId(), body.ids());
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void readAll(@AuthenticationPrincipal AppPrincipal me) {
        notifications.markAllRead(me.userId());
    }
}
