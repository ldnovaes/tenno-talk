import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { clearClientState } from "@/features/auth/lib/clearClientState";
import { failedSends, useComposerStore } from "@/features/chat/stores/composerStore";
import { useContentDraft } from "@/features/feed/hooks/useContentDraft";
import { useOnboardingDraftStore } from "@/features/onboarding/stores/onboardingDraftStore";
import { useTranslationViewStore } from "@/features/translation/stores/translationViewStore";
import { useDevicePreferencesStore } from "@/stores/devicePreferencesStore";
import { usePresenceStore } from "@/stores/presenceStore";
import { hadSession, useSessionStore } from "@/stores/sessionStore";

const reference = { messageId: "m1", senderId: "linh", preview: "Oi" };

describe("sign-out wipes every per-account store (shared devices)", () => {
  it("drafts, replies, failed sends, translation choices, onboarding and comment drafts", () => {
    useComposerStore.getState().setDraft("c1", "secret draft");
    useComposerStore.getState().setReplyTo("c1", reference);
    failedSends.set("k1", {
      clientId: "k1",
      conversationId: "c1",
      text: "x",
      media: [],
      replyToId: null,
    });
    useTranslationViewStore.getState().setOverride("m1", "original");
    useOnboardingDraftStore.getState().update({ displayName: "Ana", username: "ana" });
    const { result } = renderHook(() => useContentDraft("post:p1"));
    act(() => result.current[1]("half a comment"));

    act(() => clearClientState());

    expect(useComposerStore.getState().drafts).toEqual({});
    expect(useComposerStore.getState().replyTo).toEqual({});
    expect(failedSends.size).toBe(0);
    expect(useTranslationViewStore.getState().overrides).toEqual({});
    expect(useOnboardingDraftStore.getState()).toMatchObject({ displayName: "", username: "" });
    expect(result.current[0]).toBe("");
  });

  it("keeps device preferences (theme and the push snooze belong to the device)", () => {
    useDevicePreferencesStore.getState().setTheme("dark");
    useDevicePreferencesStore.getState().dismissPushPrompt();
    clearClientState();
    expect(useDevicePreferencesStore.getState().theme).toBe("dark");
    expect(useDevicePreferencesStore.getState().pushPromptDismissedAt).not.toBeNull();
  });
});

describe("composerStore", () => {
  it("persists drafts across reloads but never a pending reply", () => {
    useComposerStore.getState().setDraft("c1", "Oi");
    useComposerStore.getState().setReplyTo("c1", reference);
    const saved = JSON.parse(localStorage.getItem("tenno.composer") ?? "{}") as {
      state: Record<string, unknown>;
    };
    expect(saved.state).toEqual({ drafts: { c1: "Oi" } });
  });

  it("clears one conversation without touching the others", () => {
    useComposerStore.getState().setDraft("c1", "a");
    useComposerStore.getState().setDraft("c2", "b");
    useComposerStore.getState().setReplyTo("c1", reference);
    useComposerStore.getState().clear("c1");
    expect(useComposerStore.getState().drafts).toMatchObject({ c1: "", c2: "b" });
    expect(useComposerStore.getState().replyTo["c1"]).toBeNull();
  });
});

describe("presenceStore", () => {
  it("adds a typing user once and removes only that user", () => {
    const { setTyping } = usePresenceStore.getState();
    setTyping("c1", "a", true);
    setTyping("c1", "a", true);
    setTyping("c1", "b", true);
    setTyping("c2", "a", true);
    setTyping("c1", "a", false);
    expect(usePresenceStore.getState().typing).toEqual({ c1: ["b"], c2: ["a"] });
  });

  it("keeps the last seen time when going online and updates it when going offline", () => {
    const { setOnline } = usePresenceStore.getState();
    setOnline("a", false, "2026-10-05T10:00:00.000Z");
    setOnline("a", true);
    expect(usePresenceStore.getState().lastSeen["a"]).toBe("2026-10-05T10:00:00.000Z");
    setOnline("a", false, "2026-10-05T11:00:00.000Z");
    expect(usePresenceStore.getState()).toMatchObject({
      online: { a: false },
      lastSeen: { a: "2026-10-05T11:00:00.000Z" },
    });
    usePresenceStore.getState().reset();
    expect(usePresenceStore.getState()).toMatchObject({ online: {}, lastSeen: {}, typing: {} });
  });
});

describe("translationViewStore", () => {
  it("sets, replaces and removes a per-message choice", () => {
    const { setOverride } = useTranslationViewStore.getState();
    setOverride("m1", "original");
    setOverride("m1", "translation");
    setOverride("m2", "original");
    setOverride("m2", null);
    expect(useTranslationViewStore.getState().overrides).toEqual({ m1: "translation" });
  });
});

describe("onboardingDraftStore", () => {
  it("survives a reload in this tab only (sessionStorage)", () => {
    useOnboardingDraftStore.getState().update({ nativeLanguage: "vi-VN", country: "VN" });
    expect(sessionStorage.getItem("tenno.onboarding-draft")).toContain("vi-VN");
    expect(localStorage.getItem("tenno.onboarding-draft")).toBeNull();
  });
});

describe("contentDraft", () => {
  it("keeps one draft per content and applies functional updates to the latest value", () => {
    const { result } = renderHook(() => ({
      a: useContentDraft("post:a"),
      b: useContentDraft("post:b"),
    }));
    act(() => result.current.a[1]("hello"));
    act(() => result.current.a[1]((current) => `${current} world`));
    expect(result.current.a[0]).toBe("hello world");
    expect(result.current.b[0]).toBe("");
  });
});

describe("sessionStore", () => {
  it("remembers whether this browser had a session (a hint, not a credential)", () => {
    expect(hadSession()).toBe(false);
    useSessionStore.getState().setSession({ userId: "u1" });
    expect(useSessionStore.getState()).toMatchObject({ status: "authenticated", userId: "u1" });
    expect(hadSession()).toBe(true);
    useSessionStore.getState().setSession(null);
    expect(useSessionStore.getState()).toMatchObject({ status: "anonymous", userId: null });
    expect(hadSession()).toBe(false);
  });
});

describe("devicePreferencesStore", () => {
  it("records when the push invitation was dismissed", () => {
    vi.useFakeTimers({ now: 1_000 });
    useDevicePreferencesStore.getState().dismissPushPrompt();
    expect(useDevicePreferencesStore.getState().pushPromptDismissedAt).toBe(1_000);
    vi.useRealTimers();
  });
});
