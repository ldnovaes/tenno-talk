package com.tennotalk.config;


import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;

import com.tennotalk.auth.CsrfConfig;
import com.tennotalk.auth.OAuth2LoginSuccessHandler;
import com.tennotalk.common.ErrorCode;
import com.tennotalk.common.ProblemWriter;


@Configuration
public class SecurityConfig {


    @Bean
    PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    SecurityFilterChain api(HttpSecurity http, OAuth2LoginSuccessHandler oauthSuccess, TennoProperties properties)
            throws Exception {
        CookieCsrfTokenRepository csrfRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrfRepository.setCookieCustomizer(cookie -> cookie.path("/").sameSite("Lax"));
        http
                .csrf(csrf -> csrf.csrfTokenRepository(csrfRepository).csrfTokenRequestHandler(CsrfConfig.spaHandler()))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/session", "/api/auth/signup", "/api/auth/signin").permitAll()
                        .requestMatchers("/actuator/health", "/api/openapi/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/**", "/ws").authenticated()
                        .anyRequest().permitAll())
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) ->
                                ProblemWriter.write(response, ErrorCode.UNAUTHENTICATED, "Sign in to continue."))
                        .accessDeniedHandler((request, response, exception) ->
                                ProblemWriter.write(response, ErrorCode.FORBIDDEN, "You can't do this.")))
                .oauth2Login(oauth -> oauth
                        .successHandler(oauthSuccess)
                        .failureHandler((request, response, exception) ->
                                response.sendRedirect(properties.publicUrl() + "/welcome?error=oauth")))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable);
        return http.build();
    }
}
