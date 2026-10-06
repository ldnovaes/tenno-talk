package com.tennotalk.push;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Every notification type: the push says what the in-app list says (src/app/locales/en.ts, notifications.*) and
 * opens the same place (src/features/notifications/lib/destination.ts), except a follow request, which opens the
 * notifications so it can be confirmed there (PLAN.md §36.2).
 */
class PushTextTest {

    private static final UUID USER = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private static final UUID POST = UUID.fromString("00000000-0000-0000-0000-00000000000b");
    private static final UUID STORY = UUID.fromString("00000000-0000-0000-0000-00000000000c");
    private static final UUID CONVERSATION = UUID.fromString("00000000-0000-0000-0000-00000000000d");
    private static final UUID COMMENT = UUID.fromString("00000000-0000-0000-0000-00000000000e");
    private static final UUID MESSAGE = UUID.fromString("00000000-0000-0000-0000-00000000000f");

    @ParameterizedTest(name = "{0}")
    @CsvSource(delimiter = '|', value = {
            "like            | Liked your post.              | /posts/00000000-0000-0000-0000-00000000000b",
            "comment         | Commented on your post.       | /posts/00000000-0000-0000-0000-00000000000b?commentId=00000000-0000-0000-0000-00000000000e",
            "follow          | Started following you.        | /u/ana",
            "follow_request  | Requested to follow you.      | /notifications",
            "follow_accepted | Accepted your follow request. | /u/ana",
            "story_reaction  | Reacted 🔥 to your story.     | /stories/00000000-0000-0000-0000-00000000000a?storyId=00000000-0000-0000-0000-00000000000c",
            "new_message     | Sent you a message.           | /chats/00000000-0000-0000-0000-00000000000d?messageId=00000000-0000-0000-0000-00000000000f",
    })
    void eachTypeSaysWhatHappenedAndOpensItsPlace(String type, String body, String url) {
        var target = new PushDelivery.Target(USER, type, POST, STORY, CONVERSATION, "ana", COMMENT, MESSAGE, "Ana", "🔥");
        assertThat(PushDelivery.body(type, "🔥")).isEqualTo(body);
        assertThat(PushDelivery.url(target)).isEqualTo(url);
    }

    @Test
    void aStoryReactionWithoutEmojiStillReads() {
        assertThat(PushDelivery.body("story_reaction", null)).isEqualTo("Reacted to your story.");
    }

    @Test
    void unknownTypesFallBackToGenericTextAndTheNotifications() {
        assertThat(PushDelivery.body("something_new", null)).isEqualTo("You have new activity.");
        var target = new PushDelivery.Target(USER, "something_new", null, null, null, "ana", null, null, "Ana", null);
        assertThat(PushDelivery.url(target)).isEqualTo("/notifications");
    }
}
