package com.tennotalk.push;

import java.util.Map;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.HttpStatus;
import com.tennotalk.auth.AppPrincipal;

@RestController
@RequestMapping("/api/push")
public class PushController {
    private final PushSubscriptions subscriptions;
    public PushController(PushSubscriptions subscriptions) { this.subscriptions = subscriptions; }
    public record Keys(@NotBlank @Size(max=200) String p256dh, @NotBlank @Size(max=100) String auth) {}
    public record Input(@NotBlank @Size(max=4096) String endpoint, @Valid @jakarta.validation.constraints.NotNull Keys keys) {}
    public record Endpoint(@NotBlank @Size(max=4096) String endpoint) {}
    @GetMapping("/config") public Map<String, Object> config() { return Map.of("enabled", subscriptions.enabled(), "publicKey", subscriptions.publicKey()); }
    @PostMapping("/subscriptions") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subscribe(@AuthenticationPrincipal AppPrincipal user, @Valid @RequestBody Input input) {
        subscriptions.subscribe(user.userId(), input.endpoint(), input.keys().p256dh(), input.keys().auth());
    }
    @DeleteMapping("/subscriptions") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal AppPrincipal user, @Valid @RequestBody Endpoint input) { subscriptions.remove(user.userId(), input.endpoint()); }
}
