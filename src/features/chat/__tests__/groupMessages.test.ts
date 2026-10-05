import { describe, expect, it } from "vitest";

import { groupMessages } from "@/features/chat/lib/groupMessages";

import { makeMessage } from "@/test/factories";

const now = new Date(2026, 9, 3, 18, 0);
const at = (day: number, hour: number, minute: number) =>
  new Date(2026, 9, day, hour, minute).toISOString();

describe("groupMessages", () => {
  it("splits by day and labels today/yesterday", () => {
    const sections = groupMessages(
      [makeMessage({ createdAt: at(2, 9, 0) }), makeMessage({ createdAt: at(3, 9, 0) })],
      now,
    );
    expect(sections.map((s) => s.label.kind)).toEqual(["yesterday", "today"]);
  });

  it("groups consecutive messages of a sender within 5 minutes", () => {
    const messages = [
      makeMessage({ senderId: "a", createdAt: at(3, 10, 0) }),
      makeMessage({ senderId: "a", createdAt: at(3, 10, 2) }),
      makeMessage({ senderId: "a", createdAt: at(3, 10, 4) }),
      makeMessage({ senderId: "b", createdAt: at(3, 10, 5) }),
      makeMessage({ senderId: "b", createdAt: at(3, 10, 20) }),
    ];
    const groups = groupMessages(messages, now)[0]?.groups ?? [];
    expect(groups.map((g) => g.messages.length)).toEqual([3, 1, 1]);
    expect(groups[0]?.messages.map((m) => m.position)).toEqual(["first", "middle", "last"]);
    expect(groups[1]?.messages[0]?.position).toBe("single");
  });

  it("starts a new group on a new day even for the same sender", () => {
    const sections = groupMessages(
      [
        makeMessage({ senderId: "a", createdAt: at(2, 23, 58) }),
        makeMessage({ senderId: "a", createdAt: at(3, 0, 1) }),
      ],
      now,
    );
    expect(sections).toHaveLength(2);
  });

  it("uses the clientId as a stable group key for optimistic messages", () => {
    const sections = groupMessages([makeMessage({ id: "tmp_1", clientId: "k1" })], now);
    expect(sections[0]?.groups[0]?.key).toBe("k1");
  });

  it("returns nothing for no messages", () => {
    expect(groupMessages([], now)).toEqual([]);
  });
});
