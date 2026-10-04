import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { moderationService } from "@/services/moderationService";
import type { ReportReason, ReportTarget } from "@/types/moderation";

export function useReport() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: ({ target, reason }: { target: ReportTarget; reason: ReportReason }) =>
      moderationService.report(target, reason),
    onSuccess: () => toast.success(t("moderation.reported")),
  });
}
