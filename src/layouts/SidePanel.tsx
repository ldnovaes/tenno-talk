import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useCloseOverlay } from "@/app/router/overlay";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

import { PanelContext } from "./panelContext";

/** Right side panel over a blurred app (profile, settings). PLAN.md §6.4. */
export function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation();
  const close = useCloseOverlay();
  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent
        side="right"
        hideCloseButton
        closeLabel={t("common.close")}
        className="flex w-full flex-col gap-0 p-0 focus-visible:outline-none sm:max-w-[420px]"
        aria-describedby={undefined}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <SheetDescription className="sr-only">{title}</SheetDescription>
        <PanelContext.Provider value={{ close }}>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </PanelContext.Provider>
      </SheetContent>
    </Sheet>
  );
}
