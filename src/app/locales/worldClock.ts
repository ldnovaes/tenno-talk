/**
 * World clock cards (/time). Each card is written in the language of the person on the other
 * side of the pair, not in the UI language (PLAN.md §39), so these live in their own namespace.
 */
const ptBR = {
  timeIn: "Horário em {{country}}: {{time}}",
  countries: {
    br: { name: "Brasil", city: "São Paulo (UTC−3)", flag: "Bandeira do Brasil" },
    vn: { name: "Vietnã", city: "Ho Chi Minh (UTC+7)", flag: "Bandeira do Vietnã" },
  },
};

type WorldClockMessages = typeof ptBR;

const vi: WorldClockMessages = {
  timeIn: "Giờ tại {{country}}: {{time}}",
  countries: {
    br: { name: "Brazil", city: "São Paulo (UTC−3)", flag: "Quốc kỳ Brazil" },
    vn: { name: "Việt Nam", city: "TP. Hồ Chí Minh (UTC+7)", flag: "Quốc kỳ Việt Nam" },
  },
};

export const worldClockMessages = { "pt-BR": ptBR, vi } as const;
export type WorldClockLocale = keyof typeof worldClockMessages;
export type { WorldClockMessages };
