package com.tennotalk.auth;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.tennotalk.users.UserRepository;
import com.tennotalk.users.UserRow;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record SessionDto(UUID userId) {}

    public record Credentials(@NotBlank @Email String email, @NotBlank @Size(max = 200) String password) {}

    public record SignUp(@NotBlank @Email String email, @NotBlank @Size(min = 8, max = 200) String password) {}

    public record ChangePassword(String current, @NotBlank @Size(min = 8, max = 200) String next) {}

    private final AuthService auth;
    private final SessionLogin sessionLogin;
    private final UserRepository users;

    public AuthController(AuthService auth, SessionLogin sessionLogin, UserRepository users, OAuthClients oauthClients) {
        this.oauthClients = oauthClients;
        this.auth = auth;
        this.sessionLogin = sessionLogin;
        this.users = users;
    }

    /** Anonymous callers get {@code userId: null} (also primes the CSRF cookie). */
    private final OAuthClients oauthClients;

    public record Providers(java.util.List<String> providers) {}

    /** Which "Continue with …" buttons to show. */
    @GetMapping("/providers")
    public Providers providers() {
        return new Providers(oauthClients.enabled());
    }

    @GetMapping("/session")
    public SessionDto session(@AuthenticationPrincipal AppPrincipal principal) {
        if (principal == null || users.findById(principal.userId()).isEmpty()) return new SessionDto(null);
        return new SessionDto(principal.userId());
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public SessionDto signUp(@Valid @RequestBody SignUp body, HttpServletRequest request, HttpServletResponse response) {
        UUID id = auth.signUp(body.email(), body.password(), request.getHeader("Accept-Language"));
        sessionLogin.login(id, false, request, response);
        return new SessionDto(id);
    }

    @PostMapping("/signin")
    public SessionDto signIn(@Valid @RequestBody Credentials body, HttpServletRequest request, HttpServletResponse response) {
        UserRow user = auth.signIn(body.email(), body.password());
        sessionLogin.login(user.id(), "admin".equals(user.role()), request, response);
        return new SessionDto(user.id());
    }

    @PostMapping("/signout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void signOut(HttpServletRequest request) {
        sessionLogin.logout(request);
    }

    @PostMapping("/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal AppPrincipal principal, @Valid @RequestBody ChangePassword body) {
        auth.changePassword(principal.userId(), body.current(), body.next());
    }
}
