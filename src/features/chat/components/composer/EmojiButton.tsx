import { Smile } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const EmojiPickerPanel = lazy(() => import("./EmojiPickerPanel"));

export function EmojiButton({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full text-muted-foreground"
          aria-label={t("chat.composer.emoji")}
        >
          <Smile className="size-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto p-0">
        <Suspense fallback={<div className="h-[320px] w-[300px]" />}>
          <EmojiPickerPanel onSelect={onSelect} />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
