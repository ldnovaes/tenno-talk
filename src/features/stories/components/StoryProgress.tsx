import { useTranslation } from "react-i18next";

/** One segment per story of the current person. */
export function StoryProgress({
  count,
  index,
  progress,
}: {
  count: number;
  index: number;
  progress: number;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="flex gap-1"
      role="progressbar"
      aria-label={t("stories.progress", { index: index + 1, count })}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
    >
      {Array.from({ length: count }, (_, segment) => (
        <span
          key={`segment-${segment + 1}`}
          className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/35"
        >
          <span
            className="block h-full bg-white"
            style={{ width: `${segment < index ? 100 : segment === index ? progress * 100 : 0}%` }}
          />
        </span>
      ))}
    </div>
  );
}
