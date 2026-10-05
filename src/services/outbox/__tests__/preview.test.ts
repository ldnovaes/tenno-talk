import { afterEach, describe, expect, it, vi } from "vitest";

import { pendingPreview } from "@/services/outbox/preview";
import type { PendingSend } from "@/services/outbox/store";
import type { MessageContent } from "@/types/message";
import { makeMedia, makeMessage } from "@/test/factories";

afterEach(() => vi.restoreAllMocks());

function entry(content: MessageContent, blobs: (Blob | null)[]): PendingSend {
  const message = makeMessage({ id: "tmp_k", clientId: "k", content, deliveryStatus: "sending" });
  return {
    key: "u1:k",
    userId: "u1",
    input: { clientId: "k", conversationId: "c1", text: "", media: [], replyToId: null },
    message,
    blobs,
    attempts: 0,
    nextAttempt: 0,
    leaseUntil: 0,
    blocked: false,
  };
}

describe("pendingPreview (a queued send shown again after a reload)", () => {
  let next = 0;
  const create = () =>
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:new/${++next}`);
  const blob = () => new Blob(["x"]);

  it("points every stored attachment at a fresh URL of this page, and releases them", () => {
    create();
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const images = [makeMedia({ url: "blob:old/1" }), makeMedia({ url: "blob:old/2" })];
    const { message, release } = pendingPreview(
      entry({ type: "image", media: images, caption: null }, [blob(), blob()]),
    );
    const media = message.content.type === "image" ? message.content.media : [];
    expect(media.map((item) => [item.url, item.thumbnailUrl])).toEqual([
      [`blob:new/${next - 1}`, `blob:new/${next - 1}`],
      [`blob:new/${next}`, `blob:new/${next}`],
    ]);
    release();
    expect(revoke).toHaveBeenCalledTimes(2);
  });

  it("keeps an attachment already uploaded (no stored bytes)", () => {
    create();
    const uploaded = makeMedia({ url: "/api/media/done" });
    const { message } = pendingPreview(
      entry({ type: "image", media: [uploaded, makeMedia()], caption: null }, [null, blob()]),
    );
    const media = message.content.type === "image" ? message.content.media : [];
    expect(media[0]?.url).toBe("/api/media/done");
    expect(media[1]?.url).toMatch(/^blob:new\//);
  });

  it.each([
    ["video", { type: "video", media: makeMedia({ kind: "video" }), caption: null }],
    ["file", { type: "file", media: makeMedia({ kind: "file" }), fileName: "a.pdf" }],
  ] as [string, MessageContent][])("%s gets a fresh URL but no thumbnail", (_kind, content) => {
    create();
    const { message } = pendingPreview(entry(content, [blob()]));
    const media =
      message.content.type === "video" || message.content.type === "file"
        ? message.content.media
        : null;
    expect(media?.url).toMatch(/^blob:new\//);
    expect(media?.thumbnailUrl).toBeNull();
  });

  it("text is shown as is and the stored entry is never modified", () => {
    const original = entry({ type: "text", body: { text: "Oi", language: "pt-BR" } }, []);
    const copy = structuredClone(original.message);
    const { message } = pendingPreview(original);
    expect(message).toEqual(copy);
    expect(message).not.toBe(original.message);
  });
});
