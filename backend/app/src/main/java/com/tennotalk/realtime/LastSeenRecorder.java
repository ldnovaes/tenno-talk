package com.tennotalk.realtime;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.tennotalk.users.UserRepository;

/** "last seen" = when the last socket of a user closed. */
@Component
public class LastSeenRecorder {

    private final UserRepository users;

    public LastSeenRecorder(UserRepository users) {
        this.users = users;
    }

    @EventListener
    public void onPresence(PresenceChanged event) {
        if (!event.online()) users.touchLastSeen(event.userId(), event.at());
    }
}
