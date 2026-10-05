import { describe, expect, it } from "vitest";

import { i18n } from "@/app/i18n";
import { describeNotification } from "@/features/notifications/lib/notificationText";
import type { Notification } from "@/types/notification";

const base = {
  id: "n1",
  actor: { id: "a", username: "ana", displayName: "Ana", avatarUrl: null },
  createdAt: "2026-10-05T12:00:00.000Z",
  readAt: null,
};

describe("describeNotification", () => {
  it("describes follow requests and their approval", () => {
    const request: Notification = { ...base, type: "follow_request" };
    const accepted: Notification = { ...base, type: "follow_accepted" };
    expect(describeNotification(request, i18n.t)).toBe("Requested to follow you.");
    expect(describeNotification(accepted, i18n.t)).toBe("Accepted your follow request.");
  });

  it("includes the story reaction emoji", () => {
    const reaction: Notification = { ...base, type: "story_reaction", storyId: "s", emoji: "🔥" };
    expect(describeNotification(reaction, i18n.t)).toBe("Reacted 🔥 to your story.");
  });
});
