import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { paths } from "@/app/router/paths";
import {
  authService,
  type OAuthProvider,
  type PasswordCredentials,
  type Session,
} from "@/services/authService";
import { useSessionStore } from "@/stores/sessionStore";

import { clearClientState } from "../lib/clearClientState";

/** After any successful sign-in: store the session and let the guards route the user. */
function useOnSignedIn() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  return (session: Session) => {
    queryClient.clear();
    setSession(session);
    navigate(paths.home(), { replace: true });
  };
}

export function useOAuthSignIn() {
  const onSignedIn = useOnSignedIn();
  return useMutation({
    mutationFn: (provider: OAuthProvider) => authService.startOAuth(provider),
    onSuccess: onSignedIn,
  });
}

export function usePasswordSignIn() {
  const onSignedIn = useOnSignedIn();
  return useMutation({
    mutationFn: (credentials: PasswordCredentials) => authService.signInWithPassword(credentials),
    onSuccess: onSignedIn,
    meta: { silent: true },
  });
}

export function useSignUp() {
  const onSignedIn = useOnSignedIn();
  return useMutation({
    mutationFn: (credentials: PasswordCredentials) => authService.signUp(credentials),
    onSuccess: onSignedIn,
    meta: { silent: true },
  });
}

export function useDemoSignIn() {
  const onSignedIn = useOnSignedIn();
  return useMutation({
    mutationFn: (userId: string) => authService.signInAsDemo(userId),
    onSuccess: onSignedIn,
  });
}

/** Clears the server session, the query cache and every client draft. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const setSession = useSessionStore((state) => state.setSession);
  return useMutation({
    mutationFn: () => authService.signOut(),
    onSettled: () => {
      queryClient.clear();
      clearClientState();
      setSession(null);
      navigate(paths.welcome(), { replace: true });
    },
  });
}
