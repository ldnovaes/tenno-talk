import { useTranslation } from "react-i18next";

import { CountryClock } from "@/features/world-clock/components/CountryClock";
import { useNow } from "@/features/world-clock/hooks/useNow";
import { COUNTRIES, WORLD_CLOCK_PAIR } from "@/features/world-clock/lib/countries";

/** Public page (no session, no API calls): side-by-side clocks of two countries. */
export default function WorldClockPage() {
  const { t } = useTranslation();
  const now = useNow();
  return (
    <main
      aria-label={t("worldClock.title")}
      className="grid min-h-app place-items-center bg-linear-115 from-clock-cream from-5% via-clock-rose via-58% to-clock-lavender px-4 py-6 md:p-7 lg:p-12 xl:p-15"
    >
      <h1 className="sr-only">{t("worldClock.title")}</h1>
      <div className="grid w-full max-w-[480px] grid-cols-1 gap-5 md:max-w-[1420px] md:grid-cols-2">
        {WORLD_CLOCK_PAIR.map((id) => (
          <CountryClock key={id} country={COUNTRIES[id]} now={now} />
        ))}
      </div>
    </main>
  );
}
