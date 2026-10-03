import { AppError } from "@/lib/errors";
import type { AuthService, OAuthProvider, Session } from "@/services/authService";

import { http } from "./httpClient";

export const httpAuthService: AuthService = {
  async getSession() {
    const session = await http<{ userId: string | null }>("GET", "/api/auth/session");
    return session.userId ? { userId: session.userId } : null;
  },

  startOAuth(provider: OAuthProvider) {
    // Full-page round-trip through the backend; the app reloads signed in.
    window.location.assign(`/oauth2/authorization/${provider}`);
    return new Promise<Session>(() => {});
  },

  signInWithPassword(credentials) {
    return http<Session>("POST", "/api/auth/signin", { body: credentials });
  },

  signUp(credentials) {
    return http<Session>("POST", "/api/auth/signup", { body: credentials });
  },

  signInAsDemo() {
    return Promise.reject(new AppError("forbidden", "Demo accounts exist only in the mock mode."));
  },

  signOut() {
    return http<void>("POST", "/api/auth/signout");
  },

  changePassword(input) {
    return http<void>("POST", "/api/auth/password", { body: input });
  },
};
