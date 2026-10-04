import { PHRASES } from "../phrasebook";
import type { CommentRecord, PostRecord, UserRecord } from "../schema";
import { hoursAgo } from "./clock";
import { seedImage } from "./media";

interface SeedPost {
  id: string;
  authorId: string;
  phrase: string;
  hours: number;
  images: { hueA: number; hueB: number; alt: string }[];
  likedBy: string[];
}

const SEED_POSTS: SeedPost[] = [
  {
    id: "post_linh_1",
    authorId: "usr_linh",
    phrase: "post_linh_1",
    hours: 2,
    images: [{ hueA: 20, hueB: 45, alt: "Sunset over West Lake" }],
    likedBy: ["usr_rafael", "usr_minh", "usr_sofia"],
  },
  {
    id: "post_sofia_1",
    authorId: "usr_sofia",
    phrase: "post_sofia_1",
    hours: 5,
    images: [{ hueA: 280, hueB: 320, alt: "A violin on a stage" }],
    likedBy: ["usr_emma"],
  },
  {
    id: "post_rafael_1",
    authorId: "usr_rafael",
    phrase: "post_rafael_1",
    hours: 9,
    images: [
      { hueA: 195, hueB: 175, alt: "Beach in Ubatuba" },
      { hueA: 200, hueB: 60, alt: "Sea and sand" },
    ],
    likedBy: ["usr_linh", "usr_sofia"],
  },
  {
    id: "post_yuki_1",
    authorId: "usr_yuki",
    phrase: "post_yuki_1",
    hours: 14,
    images: [{ hueA: 30, hueB: 15, alt: "Coffee cup in a café" }],
    likedBy: [],
  },
  {
    id: "post_minh_1",
    authorId: "usr_minh",
    phrase: "post_minh_1",
    hours: 20,
    images: [{ hueA: 40, hueB: 30, alt: "Bánh mì sandwich" }],
    likedBy: ["usr_linh"],
  },
  {
    id: "post_emma_1",
    authorId: "usr_emma",
    phrase: "post_emma_1",
    hours: 26,
    images: [{ hueA: 10, hueB: 50, alt: "A bowl of ramen" }],
    likedBy: ["usr_yuki"],
  },
  {
    id: "post_leo_1",
    authorId: "usr_leo",
    phrase: "post_leo_1",
    hours: 33,
    images: [{ hueA: 35, hueB: 210, alt: "Rooftops of Lyon" }],
    likedBy: [],
  },
  {
    id: "post_linh_2",
    authorId: "usr_linh",
    phrase: "post_linh_2",
    hours: 40,
    images: [
      { hueA: 15, hueB: 50, alt: "Lanterns in Hội An" },
      { hueA: 45, hueB: 25, alt: "Old town street" },
      { hueA: 190, hueB: 40, alt: "River at night" },
    ],
    likedBy: ["usr_rafael"],
  },
  {
    id: "post_lena_1",
    authorId: "usr_lena",
    phrase: "post_lena_1",
    hours: 52,
    images: [{ hueA: 120, hueB: 200, alt: "Bike by the river" }],
    likedBy: [],
  },
  {
    id: "post_omar_1",
    authorId: "usr_omar",
    phrase: "post_omar_1",
    hours: 60,
    images: [{ hueA: 25, hueB: 200, alt: "Sunrise over the Nile" }],
    likedBy: ["usr_rafael"],
  },
  {
    id: "post_mei_1",
    authorId: "usr_mei",
    phrase: "post_mei_1",
    hours: 75,
    images: [{ hueA: 330, hueB: 40, alt: "Cat illustration" }],
    likedBy: [],
  },
  {
    id: "post_jisoo_1",
    authorId: "usr_jisoo",
    phrase: "post_jisoo_1",
    hours: 90,
    images: [{ hueA: 220, hueB: 260, alt: "Pencil sketch" }],
    likedBy: [],
  },
  {
    id: "post_ana_1",
    authorId: "usr_ana",
    phrase: "post_ana_1",
    hours: 110,
    images: [{ hueA: 45, hueB: 35, alt: "Custard tarts" }],
    likedBy: [],
  },
];

const SEED_COMMENTS = [
  { id: "cmt_1", postId: "post_linh_1", authorId: "usr_rafael", phrase: "comment_1", hours: 1.5 },
  { id: "cmt_2", postId: "post_linh_1", authorId: "usr_minh", phrase: "comment_2", hours: 1 },
  { id: "cmt_3", postId: "post_rafael_1", authorId: "usr_linh", phrase: "comment_3", hours: 8 },
  { id: "cmt_4", postId: "post_sofia_1", authorId: "usr_emma", phrase: "comment_4", hours: 4 },
];

/** Pre-translated into the demo accounts' languages; others go through translateContent. */
const PRETRANSLATED = ["pt-BR", "vi-VN", "en-US"];

function textFor(phraseId: string, language: string): string | undefined {
  return PHRASES.find((p) => p.id === phraseId)?.text[language];
}

function translationsFor(phraseId: string, source: string, at: string) {
  const translations: PostRecord["captionTranslations"] = {};
  for (const target of PRETRANSLATED) {
    if (target.split("-")[0] === source.split("-")[0]) continue;
    const text = textFor(phraseId, target);
    if (text)
      translations[target] = {
        targetLanguage: target,
        text,
        status: "translated",
        version: 1,
        updatedAt: at,
      };
  }
  return translations;
}

export function seedPosts(users: Record<string, UserRecord>, now = Date.now()) {
  const posts: Record<string, PostRecord> = {};
  const comments: Record<string, CommentRecord> = {};
  for (const seed of SEED_POSTS) {
    const language = users[seed.authorId]?.nativeLanguage ?? "en-US";
    const text = textFor(seed.phrase, language);
    const createdAt = hoursAgo(seed.hours, now);
    posts[seed.id] = {
      id: seed.id,
      authorId: seed.authorId,
      media: seed.images.map((image, index) =>
        seedImage(`${seed.id}_${index}`, image.hueA, image.hueB, image.alt),
      ),
      caption: text ? { text, language } : null,
      captionTranslations: translationsFor(seed.phrase, language, createdAt),
      likedBy: seed.likedBy,
      createdAt,
    };
  }
  for (const seed of SEED_COMMENTS) {
    const language = users[seed.authorId]?.nativeLanguage ?? "en-US";
    const createdAt = hoursAgo(seed.hours, now);
    comments[seed.id] = {
      id: seed.id,
      postId: seed.postId,
      authorId: seed.authorId,
      body: { text: textFor(seed.phrase, language) ?? "", language },
      translations: translationsFor(seed.phrase, language, createdAt),
      createdAt,
    };
  }
  return { posts, comments };
}
