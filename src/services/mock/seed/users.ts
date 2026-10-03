import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import type { UserRecord } from "../schema";
import { daysAgo, minutesAgo } from "./clock";

type SeedUser = Pick<
  UserRecord,
  "id" | "username" | "displayName" | "bio" | "country" | "nativeLanguage" | "learningLanguages"
> &
  Partial<UserRecord>;

const SEED_USERS: SeedUser[] = [
  {
    id: "usr_lucas",
    username: "lucas",
    displayName: "Lucas Almeida",
    bio: "Designer em São Paulo. Aprendendo vietnamita aos poucos ☕",
    country: "BR",
    nativeLanguage: "pt-BR",
    learningLanguages: ["vi-VN", "en-US"],
    email: "lucas@demo.tenno.talk",
    role: "admin",
  },
  {
    id: "usr_cam",
    username: "cam",
    displayName: "Cam Nguyen",
    bio: "Love coffee, photography and long walks in Hà Nội.",
    country: "VN",
    nativeLanguage: "vi-VN",
    learningLanguages: ["pt-BR", "en-US"],
    email: "cam@demo.tenno.talk",
  },
  {
    id: "usr_sofia",
    username: "sofia",
    displayName: "Sofía Martínez",
    bio: "Profesora de música en Valencia 🎶",
    country: "ES",
    nativeLanguage: "es-ES",
    learningLanguages: ["pt-BR"],
  },
  {
    id: "usr_emma",
    username: "emma",
    displayName: "Emma Johnson",
    bio: "Software engineer, anime fan, learning Japanese.",
    country: "US",
    nativeLanguage: "en-US",
    learningLanguages: ["ja-JP"],
  },
  {
    id: "usr_yuki",
    username: "yuki",
    displayName: "Yuki Tanaka",
    bio: "東京のカフェ巡りが好きです。",
    country: "JP",
    nativeLanguage: "ja-JP",
    learningLanguages: ["en-US"],
  },
  {
    id: "usr_minh",
    username: "minh",
    displayName: "Minh Tran",
    bio: "Street food hunter in Sài Gòn.",
    country: "VN",
    nativeLanguage: "vi-VN",
    learningLanguages: ["en-US"],
  },
  {
    id: "usr_ana",
    username: "ana",
    displayName: "Ana Ribeiro",
    bio: "Lisboa, livros e fado.",
    country: "PT",
    nativeLanguage: "pt-PT",
    learningLanguages: ["fr-FR"],
  },
  {
    id: "usr_leo",
    username: "leo",
    displayName: "Léo Dubois",
    bio: "Photographe à Lyon. J'apprends l'espagnol.",
    country: "FR",
    nativeLanguage: "fr-FR",
    learningLanguages: ["es-ES"],
  },
  {
    id: "usr_omar",
    username: "omar",
    displayName: "Omar Haddad",
    bio: "مهندس من القاهرة، أحب السفر والقهوة.",
    country: "EG",
    nativeLanguage: "ar",
    learningLanguages: ["en-US"],
  },
  {
    id: "usr_jisoo",
    username: "jisoo",
    displayName: "Ji-soo Park",
    bio: "서울에서 그림을 그려요.",
    country: "KR",
    nativeLanguage: "ko-KR",
    learningLanguages: ["vi-VN"],
  },
  {
    id: "usr_lena",
    username: "lena",
    displayName: "Lena Schmidt",
    bio: "Berlin · Radfahren · Brasilianische Musik",
    country: "DE",
    nativeLanguage: "de-DE",
    learningLanguages: ["pt-BR"],
  },
  {
    id: "usr_arjun",
    username: "arjun",
    displayName: "Arjun Mehta",
    bio: "Cricket, chai and code.",
    country: "IN",
    nativeLanguage: "hi-IN",
    learningLanguages: ["es-ES"],
  },
  {
    id: "usr_mei",
    username: "mei",
    displayName: "Mei Chen",
    bio: "上海的插画师，喜欢猫。",
    country: "CN",
    nativeLanguage: "zh-CN",
    learningLanguages: ["en-US"],
  },
];

const ONLINE = new Set(["usr_cam", "usr_sofia", "usr_minh", "usr_emma"]);

export function seedUsers(now = Date.now()): Record<string, UserRecord> {
  const users: Record<string, UserRecord> = {};
  SEED_USERS.forEach((seed, index) => {
    const isOnline = ONLINE.has(seed.id);
    users[seed.id] = {
      avatarUrl: null,
      email: null,
      password: seed.email ? "demo1234" : null,
      providers: seed.email ? ["password", "google"] : ["google"],
      role: "user",
      termsAcceptedVersion: "2026-10-03",
      onboardingCompletedAt: daysAgo(60 - index, now),
      preferences: {
        ...structuredClone(DEFAULT_PREFERENCES),
        translation: {
          ...structuredClone(DEFAULT_PREFERENCES.translation),
          receivingLanguage: seed.nativeLanguage,
        },
      },
      isOnline,
      lastSeenAt: isOnline ? null : minutesAgo(15 + index * 47, now),
      blockedUserIds: [],
      createdAt: daysAgo(60 - index, now),
      ...seed,
    };
  });
  return users;
}

export const DEMO_ACCOUNT_IDS = ["usr_lucas", "usr_cam"] as const;
