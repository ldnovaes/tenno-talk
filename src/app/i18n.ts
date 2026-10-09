import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { en } from "./locales/en";
import { worldClockMessages } from "./locales/worldClock";

export const defaultNS = "common";
export const resources = {
  en: { common: en },
  "pt-BR": { worldClock: worldClockMessages["pt-BR"] },
  vi: { worldClock: worldClockMessages.vi },
} as const;

void i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  defaultNS,
  interpolation: { escapeValue: false },
});

export { i18n };
