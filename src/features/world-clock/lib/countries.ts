import type { DayPeriod } from "./localTime";

export type CountryId = "br" | "vn";

export interface ClockCountry {
  id: CountryId;
  timeZone: string;
  /** Self-hosted landscapes (public/world-clock): the CSP only allows images from 'self'. */
  images: Record<DayPeriod, string>;
}

const image = (name: string) => `/world-clock/${name}.webp`;

export const COUNTRIES: Record<CountryId, ClockCountry> = {
  br: {
    id: "br",
    timeZone: "America/Sao_Paulo",
    images: {
      morning: image("brazil-morning"),
      afternoon: image("brazil-afternoon"),
      night: image("brazil-night"),
    },
  },
  vn: {
    id: "vn",
    timeZone: "Asia/Ho_Chi_Minh",
    // No night landscape yet: the afternoon one under the night wash.
    images: {
      morning: image("vietnam-morning"),
      afternoon: image("vietnam-afternoon"),
      night: image("vietnam-afternoon"),
    },
  },
};

/** Fixed pair for now; other countries join by adding an entry above (PLAN.md §39). */
export const WORLD_CLOCK_PAIR: readonly CountryId[] = ["br", "vn"];
