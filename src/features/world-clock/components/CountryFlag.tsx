import type { CountryId } from "../lib/countries";

function BrazilFlag() {
  return (
    <svg viewBox="0 0 72 52" aria-hidden="true" className="size-full">
      <path className="fill-flag-green" d="M0 0h72v52H0z" />
      <path className="fill-flag-gold" d="M36 6 65 26 36 46 7 26Z" />
      <circle className="fill-flag-blue" cx="36" cy="26" r="12" />
      <path
        className="fill-none stroke-clock-ink-night"
        strokeWidth="2.5"
        d="M25 22c8-2 16 1 22 7"
      />
      <circle className="fill-clock-ink-night" cx="32" cy="29" r=".8" />
      <circle className="fill-clock-ink-night" cx="37" cy="33" r=".8" />
      <circle className="fill-clock-ink-night" cx="42" cy="31" r=".8" />
      <circle className="fill-clock-ink-night" cx="33" cy="34" r=".6" />
    </svg>
  );
}

function VietnamFlag() {
  return (
    <svg viewBox="0 0 72 52" aria-hidden="true" className="size-full">
      <path className="fill-flag-red" d="M0 0h72v52H0z" />
      <path
        className="fill-flag-gold"
        d="m36 10 4 12h13l-10.5 7.6 4 12.4L36 34.4 25.5 42l4-12.4L19 22h13Z"
      />
    </svg>
  );
}

const FLAGS: Record<CountryId, () => React.JSX.Element> = { br: BrazilFlag, vn: VietnamFlag };

export function CountryFlag({ country, label }: { country: CountryId; label: string }) {
  const Flag = FLAGS[country];
  return (
    <span
      role="img"
      aria-label={label}
      className="h-[35px] w-[49px] shrink-0 overflow-hidden rounded-lg md:h-[34px] md:w-12 lg:h-11 lg:w-[62px] xl:h-[52px] xl:w-[72px]"
    >
      <Flag />
    </span>
  );
}
