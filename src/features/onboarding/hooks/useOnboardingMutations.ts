import { useMutation, useQuery } from "@tanstack/react-query";

import { useSetMe } from "@/features/auth/hooks/useMe";
import { profileKeys } from "@/features/auth/lib/queryKeys";
import { env } from "@/lib/env";
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

export function useSuggestions(limit: number) {
  return useQuery({
    queryKey: profileKeys.suggestions(limit),
    queryFn: () => profileService.getSuggestions(limit),
  });
}
