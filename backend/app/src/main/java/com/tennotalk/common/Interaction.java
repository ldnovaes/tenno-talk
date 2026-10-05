package com.tennotalk.common;

import java.util.UUID;

/**
 * Something a person did with a post or an author, published by the services after the change commits.
 * The discover ranking learns from it (PLAN.md §37.5); nothing else depends on it.
 *
 * @param postId null when the interaction is with the author only (follow, report of a person)
 * @param kind   "like", "unlike", "comment", "follow", "unfollow", "report"
 */
public record Interaction(UUID userId, UUID postId, UUID authorId, String kind) {}
