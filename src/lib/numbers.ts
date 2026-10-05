/** Short counts for tight spaces: 950, 1.2K, 3.4M (in the interface language). */
export function formatCompact(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(
      value,
    );
  } catch {
    return String(value);
  }
}
