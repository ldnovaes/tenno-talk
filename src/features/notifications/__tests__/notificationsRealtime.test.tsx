import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { chatKeys } from "@/features/chat/lib/queryKeys";
import { useNotificationsRealtime } from "@/features/notifications/hooks/useNotifications";
import { notificationKeys } from "@/features/notifications/lib/queryKeys";
import type { Notification, NotificationType } from "@/types/notification";
import { fakeRealtime } from "@/test/fakeRealtime";

/** Notifications pushed live (PLAN.md §36.2): list and badge, a toast that opens the right place, other tabs. */
let realtime: ReturnType<typeof fakeRealtime>;
let queryClient: QueryClient;

function mount() {
  queryClient = new QueryClient();
  queryClient.setQueryData(profileKeys.me(), { id: "me" });
  queryClient.setQueryData(notificationKeys.all, "cached");
  queryClient.setQueryData(chatKeys.conversations(), []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/chats"]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return renderHook(
    () => {
      useNotificationsRealtime();
      return useLocation();
    },
    { wrapper },
  );
}

const invalidated = (key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated === true;

function notification(type: NotificationType): Notification {
  const base = {
    id: `n-${type}`,
    actor: { id: "a", username: "ana", displayName: "Ana", avatarUrl: null },
    createdAt: "",
    readAt: null,
  };
  switch (type) {
    case "like":
      return { ...base, type, postId: "p1" };
    case "comment":
      return { ...base, type, postId: "p1", commentId: "c1" };
    case "story_reaction":
      return { ...base, type, storyId: "s1", emoji: "🔥" };
    case "new_message":
      return { ...base, type, conversationId: "c1", messageId: "m1" };
    default:
      return { ...base, type };
  }
}

vi.mock("sonner", async (importOriginal) => {
  const actual = await importOriginal<typeof import("sonner")>();
  return { ...actual, toast: Object.assign(vi.fn(), actual.toast) };
});

beforeEach(() => {
  realtime = fakeRealtime();
  vi.mocked(toast).mockClear();
});
afterEach(() => vi.restoreAllMocks());

describe("useNotificationsRealtime", () => {
  it.each([
    ["like", false],
    ["comment", false],
    ["story_reaction", false],
    ["new_message", false],
    ["follow", true],
    ["follow_request", true],
    ["follow_accepted", true],
  ] as [NotificationType, boolean][])(
    "%s refreshes the badge; may lift a chat restriction: %s",
    (type, chats) => {
      mount();
      act(() => realtime.emit("notification.created", { notification: notification(type) }));
      expect(invalidated(notificationKeys.all)).toBe(true);
      expect(invalidated(chatKeys.conversations())).toBe(chats);
    },
  );

  it.each([
    ["new_message", "/chats/c1?messageId=m1"],
    ["like", "/posts/p1"],
    ["follow", "/u/ana"],
  ] as [NotificationType, string][])(
    "%s: the toast says who and what; View opens %s",
    (type, destination) => {
      const { result } = mount();
      act(() => realtime.emit("notification.created", { notification: notification(type) }));
      const [title, options] = vi.mocked(toast).mock.calls.at(-1) ?? [];
      expect(title).toBe("Ana");
      expect(options?.description).toBeTruthy();
      act(() => (options?.action as { onClick: () => void } | undefined)?.onClick());
      expect(result.current.pathname + result.current.search).toBe(destination);
    },
  );

  it("reading on another device refreshes this one", () => {
    mount();
    act(() => realtime.emit("notifications.read", {}));
    expect(invalidated(notificationKeys.all)).toBe(true);
  });

  it("notifications missed while disconnected are fetched on reconnect", () => {
    mount();
    act(() => realtime.status("reconnecting"));
    expect(invalidated(notificationKeys.all)).toBe(false);
    act(() => realtime.status("open"));
    expect(invalidated(notificationKeys.all)).toBe(true);
  });
});
