const AVATAR_COLORS = [
  "bg-avatar-1",
  "bg-avatar-2",
  "bg-avatar-3",
  "bg-avatar-4",
  "bg-avatar-5",
  "bg-avatar-6",
  "bg-avatar-7",
] as const;

export function avatarColorFor(id: string): (typeof AVATAR_COLORS)[number] {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

const graphemes =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** First user-perceived character: never half of an emoji or of a letter outside the BMP. */
function firstCharacter(word: string | undefined): string {
  if (!word) return "";
  if (graphemes) return graphemes.segment(word)[Symbol.iterator]().next().value?.segment ?? "";
  return Array.from(word)[0] ?? "";
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = firstCharacter(parts[0]) || "?";
  const last = parts.length > 1 ? firstCharacter(parts[parts.length - 1]) : "";
  return (first + last).toUpperCase();
}
