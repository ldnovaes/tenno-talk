package com.tennotalk.translation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoggingAdminNotifier implements AdminNotifier {

    private static final Logger log = LoggerFactory.getLogger(LoggingAdminNotifier.class);

    @Override
    public void reauthNeeded(String provider, String reason) {
        log.warn("ACTION NEEDED: AI provider '{}' must be re-authenticated ({}). Open /admin/ai.", provider, reason);
    }

    @Override
    public void reauthChallenge(String provider, String verificationUrl, String userCode) {
        log.warn("AI provider '{}' login: open {} and enter code {}", provider, verificationUrl, userCode);
    }
}
