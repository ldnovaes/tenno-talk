import { mockAuthService } from "./mock/implementations/mockAuthService";

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
  /** Real implementation redirects the page to the backend OAuth2 flow. */
  startOAuth(provider: OAuthProvider): Promise<Session>;
  signInWithPassword(credentials: PasswordCredentials): Promise<Session>;
  signUp(credentials: PasswordCredentials): Promise<Session>;
  /** Development/demo only. */
  signInAsDemo(userId: string): Promise<Session>;
  signOut(): Promise<void>;
}

export const authService: AuthService = mockAuthService;
