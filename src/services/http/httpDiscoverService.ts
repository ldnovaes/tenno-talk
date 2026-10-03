import type { DiscoverService } from "@/services/discoverService";
import type { Page } from "@/types/api";
import type { UserProfile } from "@/types/user";

import { http } from "./httpClient";

export const httpDiscoverService: DiscoverService = {
  getPeople: (filters, cursor) =>
    http<Page<UserProfile>>("GET", "/api/discover", {
      query: { nativeLanguage: filters.nativeLanguage, cursor },
    }),
};
