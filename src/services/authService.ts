import { mockAuthService } from "./mock/implementations/mockAuthService";
import { httpAuthService } from "./http/httpAuthService";

export type OAuthProvider = "google" | "facebook";

export interface Session {
  userId: string;
}

export interface PasswordCredentials {
  email: string;
  password: string;
}

/** Authentication contract (PLAN.md §30). Components never know if it is mock or real. */
export interface AuthService {
  getSession(): Promise<Session | null>;
  /** Social logins the server has configured (others are not offered). */
  getOAuthProviders(): Promise<OAuthProvider[]>;
  /** Real implementation redirects the page to the backend OAuth2 flow. */
  startOAuth(provider: OAuthProvider): Promise<Session>;
  signInWithPassword(credentials: PasswordCredentials): Promise<Session>;
  signUp(credentials: PasswordCredentials): Promise<Session>;
  /** Development/demo only. */
  signInAsDemo(userId: string): Promise<Session>;
  signOut(): Promise<void>;
  /** Accounts created with Google/Facebook may set a first password (current = null). */
  changePassword(input: { current: string | null; next: string }): Promise<void>;
}

export const authService: AuthService = __USE_HTTP__ ? httpAuthService : mockAuthService;
