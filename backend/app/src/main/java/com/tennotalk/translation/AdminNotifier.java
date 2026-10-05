package com.tennotalk.translation;

/** Tells the administrator that an AI provider needs attention (e-mail once SMTP is configured, §34.2). */
public interface AdminNotifier {

    void providerNeedsAttention(String provider, String reason);
}
