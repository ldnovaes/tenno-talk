import { TranslatedContent } from "@/features/translation/components/TranslatedContent";
import { useContentTranslation } from "@/features/translation/hooks/useContentTranslation";
import { useTranslationPreferences } from "@/features/translation/hooks/useTranslationPreferences";
import type { Story } from "@/types/story";

/** Story text with Original / Translated (PLAN.md §9.9). */
export function StoryOverlayText({ story }: { story: Story }) {
  const { autoTranslateStories } = useTranslationPreferences();
  const state = useContentTranslation(
    { kind: "story", id: story.id },
    story.overlayText,
    story.overlayTranslation,
    autoTranslateStories,
  );
  if (!story.overlayText) return null;
  return (
    // Taps on the text (e.g. "See original") must not navigate between stories.
    <div
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      className="pointer-events-auto mx-auto max-w-[85%] rounded-2xl bg-black/45 px-4 py-2 text-center text-lg font-semibold text-white backdrop-blur-sm [&_button]:text-white/80"
    >
      <TranslatedContent state={state} />
    </div>
  );
}
