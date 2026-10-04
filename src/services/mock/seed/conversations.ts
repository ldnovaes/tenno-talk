import type { LanguageCode } from "@/types/language";

import { phraseById } from "../phrasebook";
import type { ConversationRecord, MessageRecord, UserRecord } from "../schema";
import { minutesAgo } from "./clock";
import { seedImage } from "./media";

interface Line {
  from: string;
  phrase: string;
  /** Minutes before "now". */
  at: number;
  image?: { hueA: number; hueB: number; alt: string };
}

const DAY = 24 * 60;

/** Rafael ↔ Linh: older history (pagination) + the last three days. */
function rafaelLinhLines(): Line[] {
  const history = [
    "lc_old_1",
    "lc_old_2",
    "lc_old_3",
    "lc_old_4",
    "lc_old_5",
    "lc_old_6",
    "lc_old_7",
    "lc_old_8",
  ];
  const lines: Line[] = [];
  for (let round = 0; round < 3; round++) {
    history.forEach((phrase, index) => {
      lines.push({
        from: index % 2 === 0 ? "usr_rafael" : "usr_linh",
        phrase,
        at: (9 - round * 2) * DAY + (60 - index * 5),
      });
    });
  }
  return [
    ...lines,
    { from: "usr_linh", phrase: "lc_hi", at: 2 * DAY + 300 },
    { from: "usr_rafael", phrase: "lc_fine", at: 2 * DAY + 295 },
    { from: "usr_linh", phrase: "lc_coffee", at: 2 * DAY + 290 },
    {
      from: "usr_linh",
      phrase: "lc_old_2",
      at: 2 * DAY + 289,
      image: { hueA: 205, hueB: 40, alt: "Hoan Kiem Lake at sunset" },
    },
    { from: "usr_rafael", phrase: "lc_best_coffee", at: 2 * DAY + 280 },
    { from: "usr_linh", phrase: "lc_take_you", at: 2 * DAY + 278 },
    { from: "usr_rafael", phrase: "lc_deal", at: 2 * DAY + 277 },
    { from: "usr_rafael", phrase: "lc_morning", at: DAY + 600 },
    { from: "usr_linh", phrase: "lc_slept", at: DAY + 590 },
    { from: "usr_rafael", phrase: "lc_tiring", at: DAY + 120 },
    { from: "usr_linh", phrase: "lc_rest", at: DAY + 115 },
    { from: "usr_rafael", phrase: "lc_night", at: DAY + 110 },
    { from: "usr_linh", phrase: "lc_night_reply", at: DAY + 108 },
    { from: "usr_rafael", phrase: "lc_miss", at: 95 },
    { from: "usr_linh", phrase: "lc_miss_too", at: 93 },
    { from: "usr_linh", phrase: "lc_weekend", at: 92 },
    { from: "usr_rafael", phrase: "lc_video", at: 40 },
    { from: "usr_linh", phrase: "lc_saturday", at: 38 },
    { from: "usr_rafael", phrase: "lc_cant_wait", at: 12 },
  ];
}

interface SeedConversation {
  id: string;
  members: [string, string];
  lines: Line[];
  /** Index (in lines) up to which each member has read; -1 = nothing. */
  readUpTo: Record<string, number>;
}

const SEED_CONVERSATIONS: SeedConversation[] = [
  {
    id: "conv_rafael_linh",
    members: ["usr_rafael", "usr_linh"],
    lines: rafaelLinhLines(),
    readUpTo: { usr_rafael: Infinity, usr_linh: Infinity },
  },
  {
    id: "conv_rafael_sofia",
    members: ["usr_rafael", "usr_sofia"],
    lines: [
      { from: "usr_sofia", phrase: "ls_1", at: 5 * 60 },
      { from: "usr_rafael", phrase: "ls_2", at: 4 * 60 + 50 },
      { from: "usr_sofia", phrase: "ls_3", at: 4 * 60 + 40 },
      { from: "usr_rafael", phrase: "ls_4", at: 4 * 60 + 30 },
      { from: "usr_sofia", phrase: "ls_5", at: 3 * 60 },
    ],
    readUpTo: { usr_rafael: 3, usr_sofia: Infinity },
  },
  {
    id: "conv_rafael_minh",
    members: ["usr_rafael", "usr_minh"],
    lines: [
      { from: "usr_minh", phrase: "lm_1", at: 70 },
      { from: "usr_minh", phrase: "lm_2", at: 69 },
    ],
    readUpTo: { usr_rafael: -1, usr_minh: Infinity },
  },
  {
    id: "conv_rafael_emma",
    members: ["usr_rafael", "usr_emma"],
    lines: [
      { from: "usr_emma", phrase: "le_1", at: DAY + 30 },
      { from: "usr_rafael", phrase: "le_2", at: DAY + 20 },
      { from: "usr_emma", phrase: "le_3", at: DAY + 10 },
    ],
    readUpTo: { usr_rafael: Infinity, usr_emma: Infinity },
  },
  {
    id: "conv_rafael_yuki",
    members: ["usr_rafael", "usr_yuki"],
    lines: [
      { from: "usr_yuki", phrase: "ly_1", at: 3 * DAY },
      { from: "usr_rafael", phrase: "ly_2", at: 3 * DAY - 15 },
    ],
    readUpTo: { usr_rafael: Infinity, usr_yuki: 0 },
  },
  {
    id: "conv_rafael_omar",
    members: ["usr_rafael", "usr_omar"],
    lines: [
      { from: "usr_omar", phrase: "lo_1", at: 5 * DAY },
      { from: "usr_rafael", phrase: "lo_2", at: 5 * DAY - 30 },
    ],
    readUpTo: { usr_rafael: Infinity, usr_omar: Infinity },
  },
  {
    id: "conv_linh_jisoo",
    members: ["usr_linh", "usr_jisoo"],
    lines: [
      { from: "usr_jisoo", phrase: "cj_1", at: 6 * 60 },
      { from: "usr_linh", phrase: "cj_2", at: 5 * 60 },
    ],
    readUpTo: { usr_linh: Infinity, usr_jisoo: 0 },
  },
];

function buildMessage(
  conversationId: string,
  index: number,
  line: Line,
  users: Record<string, UserRecord>,
  memberIds: string[],
  now: number,
): MessageRecord {
  const sender = users[line.from];
  if (!sender) throw new Error(`Unknown seed sender ${line.from}`);
  const phrase = phraseById(line.phrase);
  const language: LanguageCode = sender.nativeLanguage;
  const text = phrase.text[language];
  if (!text) throw new Error(`Phrase ${line.phrase} has no ${language} text`);
  const createdAt = minutesAgo(line.at, now);
  const translations: MessageRecord["translations"] = {};
  const literals: MessageRecord["literals"] = {};
  for (const memberId of memberIds) {
    const target = users[memberId]?.preferences.translation.receivingLanguage;
    if (!target || target === language) continue;
    const translated = phrase.text[target];
    translations[target] = {
      targetLanguage: target,
      text: translated ?? `«${target.split("-")[0]}» ${text}`,
      status: "translated",
      version: 1,
      updatedAt: createdAt,
    };
    const literal = phrase.literal?.[target];
    if (literal) literals[target] = literal;
  }
  const body = { text, language };
  return {
    id: `msg_${conversationId.slice(5)}_${String(index).padStart(3, "0")}`,
    clientId: null,
    conversationId,
    senderId: line.from,
    content: line.image
      ? {
          type: "image",
          media: [
            seedImage(
              `media_${conversationId}_${index}`,
              line.image.hueA,
              line.image.hueB,
              line.image.alt,
            ),
          ],
          caption: body,
        }
      : { type: "text", body },
    translations,
    literals,
    replyToId: null,
    reactions: line.phrase === "lc_miss_too" ? [{ userId: "usr_rafael", emoji: "❤️" }] : [],
    statusOverride: null,
    createdAt,
  };
}

export function seedConversations(
  users: Record<string, UserRecord>,
  now = Date.now(),
): { conversations: Record<string, ConversationRecord>; messages: Record<string, MessageRecord> } {
  const conversations: Record<string, ConversationRecord> = {};
  const messages: Record<string, MessageRecord> = {};
  for (const seed of SEED_CONVERSATIONS) {
    const records = seed.lines
      .map((line, index) => buildMessage(seed.id, index, line, users, seed.members, now))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    records.forEach((record) => (messages[record.id] = record));
    const cursor = (upTo: number) =>
      upTo < 0 ? null : (records[Math.min(upTo, records.length - 1)]?.id ?? null);
    const last = records[records.length - 1];
    conversations[seed.id] = {
      id: seed.id,
      kind: "direct",
      title: null,
      avatarUrl: null,
      createdBy: seed.members[0],
      memberIds: [...seed.members],
      lastReadMessageId: Object.fromEntries(
        seed.members.map((id) => [id, cursor(seed.readUpTo[id] ?? -1)]),
      ),
      lastDeliveredMessageId: Object.fromEntries(seed.members.map((id) => [id, last?.id ?? null])),
      mutedUntil: {},
      createdAt: records[0]?.createdAt ?? new Date(now).toISOString(),
      updatedAt: last?.createdAt ?? new Date(now).toISOString(),
    };
  }
  return { conversations, messages };
}
