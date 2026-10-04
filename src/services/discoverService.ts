import type { Page } from "@/types/api";
import type { LanguageCode } from "@/types/language";
import type { UserProfile } from "@/types/user";

import { mockDiscoverService } from "./mock/implementations/mockDiscoverService";
import { httpDiscoverService } from "./http/httpDiscoverService";

export interface DiscoverFilters {
  nativeLanguage: LanguageCode | null;
}

export interface DiscoverService {
  getPeople(filters: DiscoverFilters, cursor: string | null): Promise<Page<UserProfile>>;
}

export const discoverService: DiscoverService = __USE_HTTP__
  ? httpDiscoverService
  : mockDiscoverService;
