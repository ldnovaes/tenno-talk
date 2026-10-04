import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { REPORT_REASONS, type ReportReason, type ReportTarget } from "@/types/moderation";

import { useReport } from "../hooks/useReport";

/** One dialog for reporting people, messages, posts, comments and stories. */
export function ReportDialog({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const id = useId();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const report = useReport();

  function close() {
    setReason(null);
    onClose();
  }

  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`moderation.title.${target?.kind ?? "user"}`)}</DialogTitle>
          <DialogDescription>{t("moderation.description")}</DialogDescription>
        </DialogHeader>
        <RadioGroup
          aria-label={t("moderation.reasonLabel")}
          value={reason ?? ""}
          onValueChange={(value) => setReason(value as ReportReason)}
          className="gap-1"
        >
          {REPORT_REASONS.map((option) => (
            <div
              key={option}
              className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted"
            >
              <RadioGroupItem id={`${id}-${option}`} value={option} />
              <Label htmlFor={`${id}-${option}`} className="flex-1 font-normal">
                {t(`moderation.reasons.${option}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={!reason || !target || report.isPending}
            onClick={() => {
              if (!reason || !target) return;
              report.mutate({ target, reason }, { onSuccess: close });
            }}
          >
            {t("moderation.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
