import { useQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { profileService } from "@/services/profileService";

import { chatKeys } from "../lib/queryKeys";

export function usePeopleSearch(query: string) {
  const debounced = useDebouncedValue(query.trim(), 250);
  return useQuery({
    queryKey: chatKeys.people(debounced),
    queryFn: () => profileService.searchPeople(debounced, 20),
  });
}
