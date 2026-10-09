import "i18next";

import type { en } from "./locales/en";
import type { WorldClockMessages } from "./locales/worldClock";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: { common: typeof en; worldClock: WorldClockMessages };
  }
}
