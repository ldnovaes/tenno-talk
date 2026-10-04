package com.tennotalk.translation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class LoggingAdminNotifier implements AdminNotifier {

    private static final Logger log = LoggerFactory.getLogger(LoggingAdminNotifier.class);

    @Override
    public void providerNeedsAttention(String provider, String reason) {
        log.warn("ACTION NEEDED: AI provider '{}' stopped ({}). Check its key and credits in Infisical and the "
                + "provider console, then restart or use Check now in /admin/ai.", provider, reason);
    }
}
