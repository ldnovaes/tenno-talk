import { useQuery, useQueryClient } from "@tanstack/react-query";

import { profileService } from "@/services/profileService";
import { useSessionStore } from "@/stores/sessionStore";
import type { CurrentUser } from "@/types/user";

import { profileKeys } from "../lib/queryKeys";

/** The signed-in user (profile + account preferences). Loaded at boot by the guards. */
export function useMe() {
  const authenticated = useSessionStore((state) => state.status === "authenticated");
  return useQuery({
    queryKey: profileKeys.me(),
    queryFn: () => profileService.getMe(),
    enabled: authenticated,
    staleTime: 5 * 60_000,
  });
}

/** Non-null current user for screens rendered behind RequireOnboarded. */
export function useCurrentUser(): CurrentUser {
  const { data } = useMe();
  if (!data) throw new Error("useCurrentUser used outside of an onboarded session");
  return data;
}

export function useSetMe() {
  const queryClient = useQueryClient();
  return (user: CurrentUser) => queryClient.setQueryData(profileKeys.me(), user);
}
