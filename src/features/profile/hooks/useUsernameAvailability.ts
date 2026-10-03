import { useQuery } from "@tanstack/react-query";

import { profileKeys } from "@/features/auth/lib/queryKeys";
import { validateUsername } from "@/lib/username";
import { profileService } from "@/services/profileService";

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
