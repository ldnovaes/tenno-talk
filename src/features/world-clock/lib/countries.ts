import type { WorldClockLocale } from "@/app/locales/worldClock";

import type { DayPeriod } from "./localTime";

export type CountryId = "br" | "vn";

export interface ClockCountry {
  id: CountryId;
  timeZone: string;
  /** Language of the people who live there: the partner's card is written in it. */
  locale: WorldClockLocale;
  /** Self-hosted landscapes (public/world-clock): the CSP only allows images from 'self'. */
  images: Record<DayPeriod, string>;
}

const image = (name: string) => `/world-clock/${name}.webp`;

export const COUNTRIES: Record<CountryId, ClockCountry> = {
  br: {
    id: "br",
    timeZone: "America/Sao_Paulo",
    locale: "pt-BR",
    images: {
      morning: image("brazil-morning"),
      afternoon: image("brazil-afternoon"),
      night: image("brazil-night"),
    },
  },
  vn: {
    id: "vn",
    timeZone: "Asia/Ho_Chi_Minh",
    locale: "vi",
    images: {
      morning: image("vietnam-morning"),
      afternoon: image("vietnam-afternoon"),
      night: image("vietnam-night"),
    },
  },
};

/** Fixed pair for now; other countries join by adding an entry above (PLAN.md §39). */
export const WORLD_CLOCK_PAIR = ["br", "vn"] as const satisfies readonly [CountryId, CountryId];

/**
 * Language a country's card is shown in: the other side's, because the card is read by whoever
 * wants to know about that country (Brazil in Vietnamese, Vietnam in Portuguese).
 */
export function readerLocale(
  pair: readonly [CountryId, CountryId],
  country: CountryId,
): WorldClockLocale {
  const other = pair[0] === country ? pair[1] : pair[0];
  return COUNTRIES[other].locale;
}
