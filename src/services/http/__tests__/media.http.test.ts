import { describe, expect, it } from "vitest";

import { chatService, type MediaInput } from "@/services/chatService";
import { feedService } from "@/services/feedService";
import { upload } from "@/services/http/httpClient";
import { resolveAvatarUrl, uploadMedia } from "@/services/http/media";
import { profileService } from "@/services/profileService";
import { storyService } from "@/services/storyService";
import { fakeServer } from "@/test/fakeServer";

const photo = (name: string, sizeBytes: number): MediaInput => ({
  kind: "image",
  url: `blob:http://localhost/${name}`,
  mimeType: "image/jpeg",
  sizeBytes,
  width: 10,
  height: 10,
  durationMs: null,
  fileName: name,
});

let uploads = 0;
function serveUploads() {
  fakeServer.on("POST", "/api/media", () => ({
    body: { id: `media${++uploads}`, url: `/api/media/media${uploads}` },
  }));
}

describe("upload (XHR, PLAN.md §29)", () => {
  it("sends multipart with CSRF and the account header, and reports progress", async () => {
    serveUploads();
    const progress: number[] = [];
    const result = await upload(
      "/api/media",
      new Blob(["x"]),
      "a.jpg",
      (f) => progress.push(f),
      "u1",
    );
    const request = fakeServer.last("/api/media");
    expect(request?.transport).toBe("xhr");
    expect(request?.body).toBeInstanceOf(FormData);
    expect((request?.body as FormData).get("file")).toBeInstanceOf(Blob);
    expect(request?.headers).toMatchObject({ "x-xsrf-token": "csrf-token", "x-tenno-user": "u1" });
    expect(progress).toEqual([0.5, 1]);
    expect(result).toMatchObject({ id: expect.stringMatching(/^media/) });
  });

  it("a dropped connection is a retryable network error", async () => {
    fakeServer.on("POST", "/api/media", { networkError: true });
    await expect(upload("/api/media", new Blob(["x"]), "a.jpg")).rejects.toMatchObject({
      code: "network",
      retryable: true,
    });
  });

  it.each([
    [
      400,
      { code: "validation", detail: "This photo format isn't supported." },
      "validation",
      "This photo format isn't supported.",
    ],
    [413, "<html>Too large</html>", "validation", "Something went wrong."],
    [500, undefined, "unknown", "Something went wrong."],
  ])("HTTP %i is mapped like any other request", async (status, body, code, message) => {
    fakeServer.on("POST", "/api/media", { status, body });
    await expect(upload("/api/media", new Blob(["x"]), "a.jpg")).rejects.toMatchObject({
      code,
      message,
    });
  });
});

describe("upload rate limit", () => {
  it("keeps the server's Retry-After", async () => {
    fakeServer.on("POST", "/api/media", {
      status: 429,
      body: { code: "rate_limited" },
      headers: { "Retry-After": "12" },
    });
    await expect(upload("/api/media", new Blob(["x"]), "a.jpg")).rejects.toMatchObject({
      code: "rate_limited",
      retryAfterMs: 12_000,
    });
  });
});

describe("uploadMedia", () => {
  it("uploads in order and reports progress by bytes across files", async () => {
    serveUploads();
    const progress: number[] = [];
    const media = await uploadMedia([photo("a.jpg", 100), photo("b.jpg", 300)], (f) =>
      progress.push(f),
    );
    expect(media.map((item) => item.id)).toHaveLength(2);
    // a.jpg is a quarter of the bytes: 50% of it is 1/8, all of it 1/4; then b.jpg fills the rest.
    expect(progress).toEqual([0.125, 0.25, 0.25, 0.625, 1, 1]);
  });
});

describe("resolveAvatarUrl", () => {
  it.each([
    ["a local preview (data:)", "data:image/jpeg;base64,AAAA"],
    ["a local preview (blob:)", "blob:http://localhost/x"],
  ])("uploads %s and returns the server URL", async (_name, url) => {
    serveUploads();
    await expect(resolveAvatarUrl(url)).resolves.toMatch(/^\/api\/media\/media\d+$/);
  });

  it("onboarding and profile edits send the uploaded avatar, never the preview", async () => {
    serveUploads();
    fakeServer.on("POST", "/api/me/onboarding", (request) => ({ body: request.body }));
    const sent = (await profileService.completeOnboarding({
      nativeLanguage: "pt-BR",
      receivingLanguage: "pt-BR",
      displayName: "Rafa",
      username: "rafa",
      bio: null,
      country: "BR",
      avatarUrl: "data:image/jpeg;base64,AAAA",
    })) as unknown as { avatarUrl: string };
    expect(sent.avatarUrl).toMatch(/^\/api\/media\/media\d+$/);
  });
});

describe("services that upload first", () => {
  it("a post's progress is 90% uploading, then created", async () => {
    serveUploads();
    fakeServer.on("POST", "/api/posts", (request) => ({ body: { id: "p1", sent: request.body } }));
    const progress: number[] = [];
    const created = (await feedService.createPost(
      { media: [photo("a.jpg", 10)], caption: "Praia" },
      (p) => progress.push(p),
    )) as unknown as {
      sent: { mediaIds: string[]; caption: string };
    };
    expect(created.sent).toEqual({ mediaIds: [expect.stringMatching(/^media/)], caption: "Praia" });
    expect(progress.at(-1)).toBe(1);
    expect(Math.max(...progress.slice(0, -1))).toBeLessThanOrEqual(0.9);
  });

  it("a story sends its uploaded media id", async () => {
    serveUploads();
    fakeServer.on("POST", "/api/stories", (request) => ({ body: request.body }));
    const sent = (await storyService.createStory({
      media: photo("s.jpg", 10),
      text: "Bom dia",
    })) as unknown as {
      mediaId: string;
      text: string;
    };
    expect(sent).toEqual({ mediaId: expect.stringMatching(/^media/), text: "Bom dia" });
  });

  it("a retried message send never uploads the same files twice", async () => {
    serveUploads();
    fakeServer.once("POST", "/api/conversations/c1/messages", { networkError: true });
    fakeServer.on("POST", "/api/conversations/c1/messages", (request) => ({
      body: { id: "m1", sent: request.body },
    }));
    const input = {
      conversationId: "c1",
      clientId: "k1",
      text: "Olha",
      media: [photo("a.jpg", 10)],
      replyToId: null,
    };

    await expect(chatService.sendMessage(input)).rejects.toMatchObject({ code: "network" });
    await chatService.sendMessage(input);

    expect(fakeServer.requests.filter((request) => request.url === "/api/media")).toHaveLength(1);
    const bodies = fakeServer.requests
      .filter((r) => r.url === "/api/conversations/c1/messages")
      .map((r) => r.body);
    expect(bodies[0]).toEqual(bodies[1]);
  });
});
