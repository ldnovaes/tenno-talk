package com.tennotalk.auth;

import java.io.IOException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import com.tennotalk.common.ErrorCode;
import com.tennotalk.common.ProblemWriter;

/** Offline work may only be replayed under the account that originally queued it. */
public class ExpectedAccountFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String expected = request.getHeader("X-Tenno-User");
        if (expected != null) {
            var authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !(authentication.getPrincipal() instanceof AppPrincipal principal) || !principal.userId().toString().equals(expected)) {
                ProblemWriter.write(response, ErrorCode.UNAUTHENTICATED, "Sign in to the original account to send this message.");
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
