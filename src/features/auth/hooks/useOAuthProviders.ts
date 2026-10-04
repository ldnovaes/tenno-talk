import { useQuery } from "@tanstack/react-query";

import { authService } from "@/services/authService";

import { authKeys } from "../lib/queryKeys";

/** Only the providers configured on the server get a "Continue with …" button. */
export function useOAuthProviders() {
  return useQuery({
    queryKey: authKeys.oauthProviders(),
    queryFn: () => authService.getOAuthProviders(),
    staleTime: Infinity,
    meta: { silent: true },
  });
}
