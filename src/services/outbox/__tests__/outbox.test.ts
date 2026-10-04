import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { persistSend, listPending, updatePending } from "../store";
import { dispatchPending } from "../dispatch";
import { http } from "@/services/http/httpClient";
import { useSessionStore } from "@/stores/sessionStore";
import { AppError } from "@/lib/errors";
import type { Message } from "@/types/message";

vi.mock("@/services/http/httpClient", () => ({ http: vi.fn() }));
vi.mock("@/services/http/media", () => ({ uploadMedia: vi.fn() }));
const input = {
  clientId: "stable",
  conversationId: "conversation",
  text: "hello",
  media: [],
  replyToId: null,
};
const message: Message = {
  id: "tmp_stable",
  clientId: "stable",
  conversationId: "conversation",
  senderId: "alice",
  content: { type: "text", body: { text: "hello", language: "en-US" } },
  translation: null,
  replyTo: null,
  reactions: [],
  deliveryStatus: "sending",
  createdAt: "2026-10-04T00:00:00Z",
};
async function entry() {
  await persistSend("alice", input, message);
  const [saved] = await listPending("alice");
  if (!saved) throw new Error("Missing saved message");
  return saved;
}
afterEach(async () => {
  for (const item of await listPending("alice")) await updatePending(item.key, () => undefined);
  vi.resetAllMocks();
});
describe("persistent outbox", () => {
  it("rehydrates the same client id without leaking to another account", async () => {
    await entry();
    await persistSend("alice", { ...input, text: "duplicate" }, message);
    expect(await listPending("alice")).toHaveLength(1);
    expect((await listPending("alice"))[0]?.input.text).toBe("hello");
    expect(await listPending("bob")).toEqual([]);
  });
  it("stores attachment bytes rather than relying on a page blob URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(["image bytes"])) }),
    );
    await persistSend(
      "alice",
      {
        ...input,
        media: [
          {
            kind: "image",
            url: "blob:gone-after-reload",
            fileName: "photo.png",
            mimeType: "image/png",
            sizeBytes: 11,
            width: 1,
            height: 1,
            durationMs: null,
          },
        ],
      },
      message,
    );
    const saved = (await listPending("alice"))[0];
    expect(saved?.blobs[0]).toBeTruthy();
    expect(saved?.input.media[0]?.url).toBe("");
    vi.unstubAllGlobals();
  });
  it("allows only one tab to dispatch a claimed message", async () => {
    useSessionStore.setState({ userId: "alice", status: "authenticated" });
    const saved = await entry();
    vi.mocked(http).mockImplementation(async (method) =>
      method === "GET" ? { id: "alice" } : { ...message, id: "server", deliveryStatus: "sent" },
    );
    const result = await Promise.all([dispatchPending(saved), dispatchPending(saved)]);
    expect(result.filter(Boolean)).toHaveLength(1);
    expect(vi.mocked(http).mock.calls.filter(([method]) => method === "POST")).toHaveLength(1);
    expect(await listPending("alice")).toHaveLength(0);
  });
  it("retains a transient failure for automatic retry with the original client id", async () => {
    useSessionStore.setState({ userId: "alice", status: "authenticated" });
    const saved = await entry();
    vi.mocked(http).mockRejectedValue(new AppError("network", "offline"));
    await expect(dispatchPending(saved)).rejects.toThrow("offline");
    expect((await listPending("alice"))[0]).toMatchObject({
      blocked: false,
      attempts: 1,
      input: { clientId: "stable" },
    });
  });
  it("never dispatches another account's pending message", async () => {
    const saved = await entry();
    useSessionStore.setState({ userId: "bob", status: "authenticated" });
    expect(await dispatchPending(saved)).toBeNull();
    expect(http).not.toHaveBeenCalled();
  });
});
