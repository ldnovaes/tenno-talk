import { Search } from "lucide-react";
import { forwardRef } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";

export const ConversationSearch = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (value: string) => void }
>(function ConversationSearch({ value, onChange }, ref) {
  const { t } = useTranslation();
  return (
    <div className="relative px-4 pb-3">
      <Search
        className="pointer-events-none absolute start-7 top-1/2 size-4 -translate-y-[calc(50%+6px)] text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("chat.searchPlaceholder")}
        aria-label={t("chat.searchLabel")}
        className="h-10 rounded-full border-0 bg-muted ps-10"
      />
    </div>
  );
});
