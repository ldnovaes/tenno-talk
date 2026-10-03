import { useMutation, useQuery } from "@tanstack/react-query";

import { useSetMe } from "@/features/auth/hooks/useMe";
import { profileKeys } from "@/features/auth/lib/queryKeys";
import { env } from "@/lib/env";
import { validateUsername } from "@/lib/username";
import { profileService, type CompleteOnboardingInput } from "@/services/profileService";

export function useAcceptTerms() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: () => profileService.acceptTerms(env.termsVersion),
    onSuccess: setMe,
  });
}

export function useCompleteOnboarding() {
  const setMe = useSetMe();
  return useMutation({
    mutationFn: (input: CompleteOnboardingInput) => profileService.completeOnboarding(input),
    onSuccess: setMe,
    meta: { silent: true },
  });
}

/** Server-side availability, only for usernames that pass the local rules. */
export function useUsernameAvailability(username: string) {
  const valid = username.length > 0 && validateUsername(username) === null;
  return useQuery({
    queryKey: profileKeys.usernameCheck(username),
    queryFn: () => profileService.checkUsername(username),
    enabled: valid,
    staleTime: 30_000,
    meta: { silent: true },
  });
}

export function useSuggestions(limit: number) {
  return useQuery({
    queryKey: profileKeys.suggestions(limit),
    queryFn: () => profileService.getSuggestions(limit),
  });
}
