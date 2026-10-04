package com.tennotalk.push;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import com.tennotalk.common.ApiException;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PushSubscriptionsTest {
    private final String key = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[65]);
    private final String auth = Base64.getUrlEncoder().withoutPadding().encodeToString(new byte[16]);
    @Test void acceptsBrowserPushServices() {
        for (String host : new String[]{"fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com", "sin.notify.windows.com", "sinwns1011421.wns.windows.com"})
            assertThatCode(() -> PushSubscriptions.validate("https://" + host + "/opaque", key, auth)).doesNotThrowAnyException();
    }
    @Test void rejectsInternalHostsCredentialsFragmentsAndMalformedKeys() {
        for (String url : new String[]{"http://fcm.googleapis.com/send", "https://127.0.0.1/send", "https://fcm.googleapis.com.evil.example/send", "https://user@fcm.googleapis.com/send", "https://fcm.googleapis.com:8080/send", "https://fcm.googleapis.com/send#fragment"})
            assertThatThrownBy(() -> PushSubscriptions.validate(url, key, auth)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> PushSubscriptions.validate("https://fcm.googleapis.com/send", "bad", auth)).isInstanceOf(ApiException.class);
    }
}
