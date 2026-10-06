import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatchPending } from "@/services/outbox/dispatch";
import { listPending, persistSend, updatePending, type PendingSend } from "@/services/outbox/store";
import { useSessionStore } from "@/stores/sessionStore";
import type { Message } from "@/types/message";
import { fakeServer } from "@/test/fakeServer";
import { makeMessage } from "@/test/factories";

/**
 * The outbox state machine against a fake server (PLANO_UX.md §3.1): what each answer does to a queued send.
 * outbox.test.ts covers dedupe by clientId, stored bytes, two tabs at once and account isolation.
 */
const ME = "alice";

function online(value: boolean) {
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
}

async function queue(
  overrides: { clientId?: string; media?: number; storyId?: string } = {},
): Promise<PendingSend> {
  const clientId = overrides.clientId ?? "k1";
  const media = Array.from({ length: overrides.media ?? 0 }, (_, n) => ({
    kind: "image" as const,
    url: `blob:http://localhost/${n}`,
    mimeType: "image/jpeg",
    sizeBytes: 10,
    width: 1,
    height: 1,
    durationMs: null,
    fileName: `${n}.jpg`,
  }));
  const input = { clientId, conversationId: "c 1", text: "Oi", media, replyToId: null };
  const message: Message = makeMessage({
    id: `tmp_${clientId}`,
    clientId,
    senderId: ME,
    deliveryStatus: "sending",
  });
  await persistSend(ME, input, message, overrides.storyId);
  const saved = (await listPending(ME)).find((entry) => entry.input.clientId === clientId);
  if (!saved) throw new Error("not queued");
  return saved;
}

const stored = async (key: string) => (await listPending(ME)).find((entry) => entry.key === key);

beforeEach(() => {
  online(true);
  useSessionStore.setState({ status: "authenticated", userId: ME });
  fakeServer.on("GET", "/api/me", { body: { id: ME } });
});

afterEach(async () => {
  for (const entry of await listPending(ME)) await updatePending(entry.key, () => undefined);
  vi.restoreAllMocks();
});

describe("dispatchPending", () => {
  it("sends under its account, with its clientId, and leaves the queue", async () => {
    const entry = await queue();
    fakeServer.on("POST", "/api/conversations/c%201/messages", (request) => ({
      body: { id: "m1", sent: request.body },
    }));
    const sent = await dispatchPending(entry);
    expect(sent).toMatchObject({
      id: "m1",
      sent: { clientId: "k1", text: "Oi", mediaIds: [], replyToId: null },
    });
    expect(fakeServer.last("/api/conversations/c%201/messages")?.headers["x-tenno-user"]).toBe(ME);
    expect(await stored(entry.key)).toBeUndefined();
  });

  it("waits while offline without touching the entry", async () => {
    const entry = await queue();
    online(false);
    expect(await dispatchPending(entry)).toBeNull();
    expect(fakeServer.requests).toHaveLength(0);
    expect(await stored(entry.key)).toMatchObject({ attempts: 0, blocked: false });
  });

  it("a send whose account changed on the server is held until that account returns", async () => {
    const entry = await queue();
    fakeServer.reset();
    fakeServer.on("GET", "/api/me", { body: { id: "bob" } });
    await expect(dispatchPending(entry)).rejects.toMatchObject({ code: "unauthenticated" });
    expect(await stored(entry.key)).toMatchObject({
      blocked: true,
      failureCode: "unauthenticated",
      attempts: 1,
      message: { deliveryStatus: "failed" },
    });
    expect(fakeServer.requests.filter((r) => r.method === "POST")).toHaveLength(0);
  });

  it.each([
    [403, "forbidden"],
    [400, "validation"],
    [404, "not_found"],
    [409, "conflict"],
  ])("a refusal (%i) fails for good and shows Retry/Discard", async (status, code) => {
    const entry = await queue();
    fakeServer.on("POST", "/api/conversations/c%201/messages", { status, body: { code } });
    await expect(dispatchPending(entry)).rejects.toMatchObject({ code });
    expect(await stored(entry.key)).toMatchObject({
      blocked: true,
      failureCode: code,
      message: { deliveryStatus: "failed" },
    });
  });

  it.each([
    [503, "unknown"],
    [429, "rate_limited"],
  ])(
    "a transient failure (%i) stays queued as sending and waits before the next try",
    async (status, code) => {
      const entry = await queue();
      vi.spyOn(Math, "random").mockReturnValue(0);
      const before = Date.now();
      fakeServer.on("POST", "/api/conversations/c%201/messages", { status, body: { code } });
      await expect(dispatchPending(entry)).rejects.toMatchObject({ code });
      const after = await stored(entry.key);
      expect(after).toMatchObject({
        blocked: false,
        attempts: 1,
        leaseUntil: 0,
        message: { deliveryStatus: "sending" },
      });
      expect(after?.nextAttempt).toBeGreaterThanOrEqual(before + 1000);
    },
  );

  it.each([0, 1, 2, 3, 5, 6, 7, 10])(
    "backoff after %i attempts doubles up to a minute, with jitter",
    async (attempts) => {
      const entry = await queue();
      await updatePending(entry.key, (e) => (e ? { ...e, attempts } : e));
      fakeServer.on("POST", "/api/conversations/c%201/messages", { networkError: true });
      const base = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6));
      for (const random of [0, 0.999]) {
        vi.spyOn(Math, "random").mockReturnValue(random);
        await updatePending(entry.key, (e) => (e ? { ...e, nextAttempt: 0, attempts } : e));
        const before = Date.now();
        await expect(dispatchPending(entry)).rejects.toMatchObject({ code: "network" });
        const wait = ((await stored(entry.key))?.nextAttempt ?? 0) - before;
        expect(wait).toBeGreaterThanOrEqual(base * (1 + random) - 50);
        expect(wait).toBeLessThanOrEqual(base * (1 + random) + 1000);
      }
    },
  );

  it("a rate-limited send waits at least what the server asked", async () => {
    const entry = await queue();
    vi.spyOn(Math, "random").mockReturnValue(0);
    fakeServer.on("POST", "/api/conversations/c%201/messages", {
      status: 429,
      body: { code: "rate_limited" },
      headers: { "Retry-After": "120" },
    });
    const before = Date.now();
    await expect(dispatchPending(entry)).rejects.toMatchObject({ code: "rate_limited" });
    expect(((await stored(entry.key))?.nextAttempt ?? 0) - before).toBeGreaterThanOrEqual(120_000);
  });

  it("does nothing before its next attempt is due", async () => {
    const entry = await queue();
    await updatePending(entry.key, (e) => (e ? { ...e, nextAttempt: Date.now() + 60_000 } : e));
    expect(await dispatchPending(entry)).toBeNull();
    expect(fakeServer.requests).toHaveLength(0);
  });

  it("another tab's live lease keeps this tab away; an expired lease is taken over", async () => {
    const entry = await queue();
    fakeServer.on("POST", "/api/conversations/c%201/messages", { body: { id: "m1" } });
    await updatePending(entry.key, (e) => (e ? { ...e, leaseUntil: Date.now() + 30_000 } : e));
    expect(await dispatchPending(entry)).toBeNull();
    await updatePending(entry.key, (e) => (e ? { ...e, leaseUntil: Date.now() - 1 } : e));
    expect(await dispatchPending(entry)).toMatchObject({ id: "m1" });
  });

  it("resumes an interrupted upload without sending the finished files again", async () => {
    // Stored bytes become a URL of this page again before uploading.
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/restored");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const entry = await queue({ media: 2 });
    let uploads = 0;
    fakeServer.on("POST", "/api/media", () =>
      ++uploads === 2 ? { networkError: true } : { body: { id: `media${uploads}` } },
    );
    fakeServer.on("POST", "/api/conversations/c%201/messages", (request) => ({
      body: { id: "m1", sent: request.body },
    }));

    await expect(dispatchPending(entry)).rejects.toMatchObject({ code: "network" });
    expect(await stored(entry.key)).toMatchObject({ mediaIds: ["media1"] });

    await updatePending(entry.key, (e) => (e ? { ...e, nextAttempt: 0 } : e));
    const sent = await dispatchPending(entry);
    expect(uploads).toBe(3);
    expect(sent).toMatchObject({ sent: { mediaIds: ["media1", "media3"] } });
  });

  it("a story reply goes to the story's endpoint and returns the message", async () => {
    const entry = await queue({ clientId: "r1", storyId: "s/1" });
    fakeServer.on("POST", "/api/stories/s%2F1/replies", (request) => ({
      body: { conversationId: "c9", message: { id: "m9", sent: request.body } },
    }));
    expect(await dispatchPending(entry)).toMatchObject({
      id: "m9",
      sent: { clientId: "r1", text: "Oi" },
    });
  });

  it("a send discarded while it was uploading is never posted", async () => {
    const entry = await queue();
    fakeServer.reset();
    fakeServer.on("GET", "/api/me", () => {
      void updatePending(entry.key, () => undefined);
      return { body: { id: ME } };
    });
    fakeServer.on("POST", "/api/conversations/c%201/messages", { body: { id: "m1" } });
    expect(await dispatchPending(entry)).toBeNull();
    expect(fakeServer.requests.filter((r) => r.method === "POST")).toHaveLength(0);
  });

  it("signing into another account mid-send releases the claim for the right account", async () => {
    const entry = await queue();
    fakeServer.reset();
    fakeServer.on("GET", "/api/me", () => {
      useSessionStore.setState({ status: "authenticated", userId: "bob" });
      return { body: { id: ME } };
    });
    fakeServer.on("POST", "/api/conversations/c%201/messages", { body: { id: "m1" } });
    expect(await dispatchPending(entry)).toBeNull();
    expect(fakeServer.requests.filter((r) => r.method === "POST")).toHaveLength(0);
    expect(await stored(entry.key)).toMatchObject({ leaseUntil: 0, blocked: false });
  });
});
