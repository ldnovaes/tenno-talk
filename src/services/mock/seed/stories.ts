import { PHRASES } from "../phrasebook";
import type { NotificationRecord, StoryRecord, UserRecord } from "../schema";
import { hoursAgo, minutesAgo } from "./clock";
import { seedImage } from "./media";

const SEED_STORIES = [
  {
    id: "story_linh_1",
    authorId: "usr_linh",
    phrase: "story_linh_1",
    hours: 3,
    hueA: 35,
    hueB: 20,
    viewedBy: [] as string[],
  },
  {
    id: "story_linh_2",
    authorId: "usr_linh",
    phrase: "story_linh_2",
    hours: 1,
    hueA: 200,
    hueB: 170,
    viewedBy: [],
  },
  {
    id: "story_sofia_1",
    authorId: "usr_sofia",
    phrase: "story_sofia_1",
    hours: 6,
    hueA: 300,
    hueB: 330,
    viewedBy: [],
  },
  {
    id: "story_minh_1",
    authorId: "usr_minh",
    phrase: "story_minh_1",
    hours: 9,
    hueA: 15,
    hueB: 40,
    viewedBy: ["usr_rafael"],
  },
  {
    id: "story_emma_1",
    authorId: "usr_emma",
    phrase: "story_emma_1",
    hours: 12,
    hueA: 230,
    hueB: 270,
    viewedBy: [],
  },
  {
    id: "story_rafael_1",
    authorId: "usr_rafael",
    phrase: "story_rafael_1",
    hours: 4,
    hueA: 45,
    hueB: 30,
    viewedBy: ["usr_linh"],
  },
];

const PRETRANSLATED = ["pt-BR", "vi-VN", "en-US"];

export function seedStories(
  users: Record<string, UserRecord>,
  now = Date.now(),
): Record<string, StoryRecord> {
  const stories: Record<string, StoryRecord> = {};
  for (const seed of SEED_STORIES) {
    const language = users[seed.authorId]?.nativeLanguage ?? "en-US";
    const phrase = PHRASES.find((p) => p.id === seed.phrase);
    const text = phrase?.text[language];
    const createdAt = hoursAgo(seed.hours, now);
    const overlayTranslations: StoryRecord["overlayTranslations"] = {};
    for (const target of PRETRANSLATED) {
      const translated = phrase?.text[target];
      if (target !== language && translated) {
        overlayTranslations[target] = {
          targetLanguage: target,
          text: translated,
          status: "translated",
          version: 1,
          updatedAt: createdAt,
        };
      }
    }
    stories[seed.id] = {
      id: seed.id,
      authorId: seed.authorId,
      media: seedImage(`${seed.id}_media`, seed.hueA, seed.hueB, "Story", {
        width: 1080,
        height: 1920,
      }),
      overlayText: text ? { text, language } : null,
      overlayTranslations,
      viewedBy: seed.viewedBy,
      reactions: [],
      createdAt,
      expiresAt: new Date(new Date(createdAt).getTime() + 24 * 3600_000).toISOString(),
    };
  }
  return stories;
}

function notification(
  id: string,
  recipientId: string,
  actorId: string,
  type: NotificationRecord["type"],
  minutes: number,
  extra: Partial<NotificationRecord>,
  now: number,
): NotificationRecord {
  return {
    id,
    recipientId,
    actorId,
    type,
    postId: null,
    commentId: null,
    storyId: null,
    emoji: null,
    conversationId: null,
    messageId: null,
    readAt: null,
    createdAt: minutesAgo(minutes, now),
    ...extra,
  };
}

export function seedNotifications(now = Date.now()): Record<string, NotificationRecord> {
  const list = [
    notification(
      "ntf_1",
      "usr_rafael",
      "usr_linh",
      "story_reaction",
      50,
      { storyId: "story_rafael_1", emoji: "😍" },
      now,
    ),
    notification(
      "ntf_2",
      "usr_rafael",
      "usr_linh",
      "comment",
      8 * 60,
      { postId: "post_rafael_1", commentId: "cmt_3" },
      now,
    ),
    notification(
      "ntf_3",
      "usr_rafael",
      "usr_linh",
      "like",
      8 * 60 + 5,
      { postId: "post_rafael_1" },
      now,
    ),
    notification(
      "ntf_4",
      "usr_rafael",
      "usr_sofia",
      "like",
      26 * 60,
      { postId: "post_rafael_1" },
      now,
    ),
    notification(
      "ntf_5",
      "usr_rafael",
      "usr_sofia",
      "follow",
      3 * 24 * 60,
      { readAt: minutesAgo(2 * 24 * 60, now) },
      now,
    ),
    notification(
      "ntf_6",
      "usr_rafael",
      "usr_minh",
      "new_message",
      69,
      { conversationId: "conv_rafael_minh" },
      now,
    ),
    notification("ntf_7", "usr_linh", "usr_rafael", "like", 60, { postId: "post_linh_1" }, now),
  ];
  return Object.fromEntries(list.map((item) => [item.id, item]));
}
