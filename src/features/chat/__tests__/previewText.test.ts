import { describe, expect, it } from "vitest";

import { mediaLabelOf, originalOf } from "@/features/chat/lib/messageText";
import { displayTextFor, previewText } from "@/features/chat/lib/previewText";
import type { MessageContent } from "@/types/message";
import type { TranslationDisplayMode } from "@/types/preferences";
import { caseName, cartesian } from "@/test/combinations";

import { makeMedia, makeMessage } from "@/test/factories";

const labels = {
  you: (text: string) => `You: ${text}`,
  media: { photo: "📷 Photo", video: "🎬 Video", audio: "🎤 Voice", file: "📎 File" },
};

const media = makeMedia();
const written = { text: "Anh nhớ em", language: "vi-VN" } as const;

/** Every content kind, with and without the text the sender wrote. */
const CONTENTS: Record<string, { content: MessageContent; text: boolean; label: string | null }> = {
  text: { content: { type: "text", body: written }, text: true, label: null },
  story_reply: {
    content: { type: "story_reply", storyId: "s1", body: written },
    text: true,
    label: null,
  },
  image: {
    content: { type: "image", media: [media], caption: null },
    text: false,
    label: "📷 Photo",
  },
  image_caption: {
    content: { type: "image", media: [media], caption: written },
    text: true,
    label: "📷 Photo",
  },
  video: { content: { type: "video", media, caption: null }, text: false, label: "🎬 Video" },
  video_caption: {
    content: { type: "video", media, caption: written },
    text: true,
    label: "🎬 Video",
  },
  audio: { content: { type: "audio", media }, text: false, label: "🎤 Voice" },
  file: { content: { type: "file", media, fileName: "a.pdf" }, text: false, label: "📎 File" },
};

const MODES: TranslationDisplayMode[] = ["translation", "both", "original"];

describe("previewText (every content kind × mode × own × translation ready)", () => {
  const rows = cartesian({
    kind: Object.keys(CONTENTS),
    mode: MODES,
    own: [false, true],
    translated: [false, true],
  });

  it.each(rows.map((row) => [caseName(row), row] as const))("%s", (_name, row) => {
    const spec = CONTENTS[row.kind];
    if (!spec) throw new Error(row.kind);
    const message = makeMessage({
      senderId: row.own ? "me" : "linh",
      content: spec.content,
      translation: row.translated
        ? {
            targetLanguage: "pt-BR",
            text: "Saudade",
            status: "translated",
            version: 1,
            updatedAt: "",
          }
        : { targetLanguage: "pt-BR", text: null, status: "pending", version: 0, updatedAt: "" },
    });

    // The list shows what the bubble shows by default: received + ready + not "original" → translation.
    const showsTranslation = !row.own && row.translated && row.mode !== "original";
    const text = spec.text ? (showsTranslation ? "Saudade" : written.text) : null;
    const body = [spec.label, text].filter((part) => part !== null).join(" · ");

    expect(displayTextFor(message, "me", row.mode)).toBe(text);
    expect(previewText(message, "me", labels, row.mode)).toBe(row.own ? `You: ${body}` : body);
  });
});

describe("messageText", () => {
  it.each(Object.entries(CONTENTS))("%s: original text and media label", (_kind, spec) => {
    expect(originalOf({ content: spec.content })).toEqual(spec.text ? written : null);
    const label = mediaLabelOf({ content: spec.content });
    expect(label === null ? null : labels.media[label]).toBe(spec.label);
  });
});
