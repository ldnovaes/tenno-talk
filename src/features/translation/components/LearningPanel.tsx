import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/useBreakpoint";
import type { OriginalText } from "@/types/message";

import { useTranslationInsight } from "../hooks/useTranslationInsight";

interface LearningPanelProps {
  messageId: string | null;
  original: OriginalText | null;
  targetLanguage: string | null;
  onClose: () => void;
}

function Row({
  label,
  children,
  lang,
}: {
  label: string;
  children: ReactNode;
  lang?: string | undefined;
}) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd lang={lang} dir="auto" className="text-[15px]">
        {children}
      </dd>
    </div>
  );
}

function PanelBody({ messageId, original, targetLanguage }: Omit<LearningPanelProps, "onClose">) {
  const { t } = useTranslation();
  const insight = useTranslationInsight(messageId, targetLanguage);
  if (insight.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
    );
  }
  if (!insight.data || !original)
    return <p className="text-sm text-muted-foreground">{t("errors.generic")}</p>;
  return (
    <dl className="space-y-4">
      <Row label={t("translation.learning.natural")} lang={insight.data.targetLanguage}>
        {insight.data.natural}
      </Row>
      <Row label={t("translation.learning.original")} lang={original.language}>
        {original.text}
      </Row>
      <Row label={t("translation.learning.literal")} lang={insight.data.targetLanguage}>
        {insight.data.literal}
      </Row>
      <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-xs text-muted-foreground">
        {(["explanation", "vocabulary", "pronunciation"] as const).map((key) => (
          <span key={key} className="rounded-lg bg-muted px-2 py-2">
            {t(`translation.learning.${key}`)}
            <span className="block opacity-70">{t("translation.learning.comingSoon")}</span>
          </span>
        ))}
      </div>
    </dl>
  );
}

/** Learning Mode details: opened on demand, never inline in the bubble. */
export function LearningPanel(props: LearningPanelProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const open = props.messageId !== null;
  const title = (
    <span className="flex items-center gap-2">
      <GraduationCap className="size-5 text-primary" aria-hidden />
      {t("translation.learning.title")}
    </span>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(next) => !next && props.onClose()}>
        <DrawerContent>
          <DrawerHeader className="text-start">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{t("translation.learning.description")}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6 pb-safe">
            <PanelBody {...props} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={(next) => !next && props.onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("translation.learning.description")}</DialogDescription>
        </DialogHeader>
        <PanelBody {...props} />
      </DialogContent>
    </Dialog>
  );
}
