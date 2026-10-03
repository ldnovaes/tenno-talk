package com.tennotalk.translation;

/** Tells the administrator that an AI login needs attention (e-mail once SMTP is configured, §34.2). */
public interface AdminNotifier {

    void reauthNeeded(String provider, String reason);

    void reauthChallenge(String provider, String verificationUrl, String userCode);
}
