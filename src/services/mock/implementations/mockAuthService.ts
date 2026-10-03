import { AppError } from "@/lib/errors";
import { detectSystemLanguage } from "@/lib/languages";
import type {
  AuthService,
  OAuthProvider,
  PasswordCredentials,
  Session,
} from "@/services/authService";
import type { AuthProvider } from "@/types/user";

import { mockDb } from "../db";
import { DEFAULT_PREFERENCES } from "../defaults";
import { mockRequest } from "../latency";
import type { UserRecord } from "../schema";
import { clearMockSession, readMockSession, writeMockSession } from "../session";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function newUser(
  id: string,
  email: string | null,
  provider: AuthProvider,
  password: string | null,
): UserRecord {
  const language = detectSystemLanguage();
  const now = new Date().toISOString();
  return {
    id,
    username: "",
    displayName: "",
    avatarUrl: null,
    bio: null,
    country: "",
    nativeLanguage: language,
    learningLanguages: [],
    email,
    password,
    providers: [provider],
    role: "user",
    termsAcceptedVersion: null,
    onboardingCompletedAt: null,
    preferences: {
      ...structuredClone(DEFAULT_PREFERENCES),
      translation: {
        ...structuredClone(DEFAULT_PREFERENCES.translation),
        receivingLanguage: language,
      },
    },
    isOnline: true,
    lastSeenAt: null,
    blockedUserIds: [],
    createdAt: now,
  };
}

function startSession(userId: string): Session {
  writeMockSession(userId);
  return { userId };
}

export const mockAuthService: AuthService = {
  getSession() {
    return mockRequest(() => {
      const session = readMockSession();
      if (!session || !mockDb.read().users[session.userId]) return null;
      return session;
    });
  },

  startOAuth(provider: OAuthProvider) {
    // Simulates the provider round-trip: a brand-new account each time.
    return mockRequest(() =>
      mockDb.update((db) => {
        const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
        const email = `${id.slice(4)}@${provider === "google" ? "gmail.com" : "facebook.com"}`;
        db.users[id] = newUser(id, provider === "facebook" ? null : email, provider, null);
        return startSession(id);
      }),
    );
  },

  signInWithPassword({ email, password }: PasswordCredentials) {
    return mockRequest(() => {
      const normalized = normalizeEmail(email);
      const user = Object.values(mockDb.read().users).find((u) => u.email === normalized);
      if (!user || user.password !== password) {
        throw new AppError("unauthenticated", "Invalid email or password.");
      }
      return startSession(user.id);
    });
  },

  signUp({ email, password }: PasswordCredentials) {
    return mockRequest(() =>
      mockDb.update((db) => {
        const normalized = normalizeEmail(email);
        if (Object.values(db.users).some((u) => u.email === normalized)) {
          throw new AppError("conflict", "An account with this email already exists.", {
            fieldErrors: { email: "An account with this email already exists." },
          });
        }
        const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
        db.users[id] = newUser(id, normalized, "password", password);
        return startSession(id);
      }),
    );
  },

  signInAsDemo(userId: string) {
    return mockRequest(() => {
      if (!mockDb.read().users[userId]) throw new AppError("not_found", "Demo account not found.");
      return startSession(userId);
    });
  },

  signOut() {
    return mockRequest(() => {
      clearMockSession();
    });
  },
};
