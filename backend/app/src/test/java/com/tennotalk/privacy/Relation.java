package com.tennotalk.privacy;

import java.util.UUID;

import com.tennotalk.support.TestData;

/** How a viewer relates to an owner (PLAN.md §31.1 "Relações cobertas"); shared by the privacy matrices. */
enum Relation {
    STRANGER, I_FOLLOW, FOLLOWS_ME, MUTUAL, I_REQUESTED, OWNER_REQUESTED, I_BLOCKED, BLOCKED_ME, MUTUAL_BLOCK;

    boolean blocked() { return this == I_BLOCKED || this == BLOCKED_ME || this == MUTUAL_BLOCK; }

    boolean ownerFollowsViewer() { return this == FOLLOWS_ME || this == MUTUAL; }

    boolean viewerFollowsOwner() { return this == I_FOLLOW || this == MUTUAL; }

    /** A pending request to a public profile can't exist: going public approves them all. */
    boolean possibleWith(String visibility) { return this != I_REQUESTED || !"public".equals(visibility); }

    void arrange(TestData data, UUID viewer, UUID owner) {
        switch (this) {
            case STRANGER -> { }
            case I_FOLLOW -> data.follow(viewer, owner);
            case FOLLOWS_ME -> data.follow(owner, viewer);
            case MUTUAL -> {
                data.follow(viewer, owner);
                data.follow(owner, viewer);
            }
            case I_REQUESTED -> data.requestFollow(viewer, owner);
            case OWNER_REQUESTED -> {
                data.setPreference(viewer, "profile_visibility", "private");
                data.requestFollow(owner, viewer);
            }
            case I_BLOCKED -> data.block(viewer, owner);
            case BLOCKED_ME -> data.block(owner, viewer);
            case MUTUAL_BLOCK -> {
                data.block(viewer, owner);
                data.block(owner, viewer);
            }
        }
    }
}
