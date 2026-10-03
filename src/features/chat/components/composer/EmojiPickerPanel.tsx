import { EmojiPicker } from "frimousse";
import { useTranslation } from "react-i18next";

/** Loaded lazily (PLAN.md §22). Emoji data comes from emojibase (self-host in Phase 10). */
export default function EmojiPickerPanel({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { t } = useTranslation();
  return (
    <EmojiPicker.Root
      className="flex h-[320px] w-[300px] flex-col"
      onEmojiSelect={({ emoji }) => onSelect(emoji)}
    >
      <EmojiPicker.Search
        placeholder={t("common.search")}
        className="mx-2 mt-2 h-9 rounded-lg bg-muted px-3 text-sm outline-none"
      />
      <EmojiPicker.Viewport className="relative flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          {t("common.loading")}
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          —
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-1.5"
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                className="bg-popover px-3 pb-1.5 pt-3 text-xs font-medium text-muted-foreground"
                {...props}
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div className="scroll-my-1.5 px-1.5" {...props}>
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                type="button"
                className="grid size-8 place-items-center rounded-md text-xl data-[active]:bg-muted"
                {...props}
              >
                {emoji.emoji}
              </button>
            ),
          }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}
