import { useTranslation } from "react-i18next";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import type { ConversationFilter } from "../../lib/conversationFilters";

export function ConversationFilters({
  value,
  onChange,
  showGroups,
}: {
  value: ConversationFilter;
  onChange: (value: ConversationFilter) => void;
  showGroups: boolean;
}) {
  const { t } = useTranslation();
  const options: ConversationFilter[] = showGroups
    ? ["all", "unread", "groups"]
    : ["all", "unread"];
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => next && onChange(next as ConversationFilter)}
      aria-label={t("chat.filters.label")}
      className="justify-start gap-1.5 px-4 pb-2"
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option}
          value={option}
          className="h-8 rounded-full border-0 bg-muted px-3.5 text-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
        >
          {t(`chat.filters.${option}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
