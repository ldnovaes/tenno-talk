import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import type { ClockCountry } from "../lib/countries";
import { getLocalTime } from "../lib/localTime";
import { CountryFlag } from "./CountryFlag";

export function CountryClock({ country, now }: { country: ClockCountry; now: Date }) {
  const { t, i18n } = useTranslation();
  const local = getLocalTime(now, country.timeZone, i18n.language);
  const night = local.period === "night";
  const name = t(`worldClock.countries.${country.id}.name`);
  const titleId = `world-clock-${country.id}`;

  return (
    <section
      aria-labelledby={titleId}
      data-period={local.period}
      className={cn(
        "relative isolate aspect-[1.2] overflow-hidden rounded-3xl shadow-xl md:aspect-[1.23]",
        night ? "text-clock-ink-night" : "text-clock-ink",
      )}
    >
      <img
        src={country.images[local.period]}
        alt=""
        decoding="async"
        className="absolute inset-0 -z-20 size-full object-cover"
      />
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 -z-10 rounded-[inherit] border border-clock-edge bg-linear-to-b",
          night
            ? "from-clock-night-wash via-clock-night-wash via-55% to-transparent"
            : "from-clock-day-wash via-clock-day-wash via-48% to-transparent to-77%",
        )}
      />
      <div className="px-3 pt-6 text-center md:pt-6.5 lg:px-4 lg:pt-8.5 xl:pt-10">
        <div className="flex items-center justify-center gap-3.5 md:gap-3 lg:gap-5">
          <CountryFlag country={country.id} />
          <h2
            id={titleId}
            className="text-[26px] leading-tight font-semibold md:text-[25px] lg:text-[32px] xl:text-4xl"
          >
            {name}
          </h2>
        </div>
        <p
          className={cn(
            "mt-2 mb-2.5 text-lg md:text-lg lg:text-[23px]",
            night ? "text-clock-ink-night" : "text-clock-ink-muted",
          )}
        >
          {t(`worldClock.countries.${country.id}.city`)}
        </p>
        <time
          dateTime={now.toISOString()}
          aria-label={t("worldClock.timeIn", { country: name, time: local.time })}
          className="block text-[80px] leading-[1.12] font-semibold tabular-nums max-[350px]:text-[70px] md:text-[82px] lg:text-[116px] xl:text-[140px]"
        >
          {local.time}
        </time>
        <p className="mt-1 text-[21px] max-[350px]:text-lg md:text-xl lg:text-[27px] xl:text-[30px]">
          {local.date}
        </p>
      </div>
    </section>
  );
}
