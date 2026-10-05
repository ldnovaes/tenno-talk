package com.tennotalk.push;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PushTextTest {
    @Test
    void eachTypeHasItsOwnWording() {
        assertThat(PushDelivery.body("follow_request", null)).isEqualTo("Requested to follow you.");
        assertThat(PushDelivery.body("follow_accepted", null)).isEqualTo("Accepted your follow request.");
        assertThat(PushDelivery.body("story_reaction", "🔥")).isEqualTo("Reacted 🔥 to your story.");
        assertThat(PushDelivery.body("new_message", null)).isEqualTo("Sent you a message.");
    }

    @Test
    void unknownTypesFallBackToGenericText() {
        assertThat(PushDelivery.body("something_new", null)).isEqualTo("You have new activity.");
    }
}
