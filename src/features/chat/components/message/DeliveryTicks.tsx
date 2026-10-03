import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { DeliveryStatus } from "@/types/message";

/** clock → ✓ → ✓✓ → ✓✓ (primary) / failed. PLAN.md §13.1. */
export function DeliveryTicks({
  status,
  className,
}: {
  status: DeliveryStatus;
  className?: string | undefined;
}) {
  const { t } = useTranslation();
  const label = t(`chat.status.${status}`);
  const common = cn("size-4 shrink-0", className);
  switch (status) {
    case "sending":
      return <Clock className={cn(common, "size-3.5")} aria-label={label} role="img" />;
    case "sent":
      return <Check className={common} aria-label={label} role="img" />;
    case "delivered":
      return <CheckCheck className={common} aria-label={label} role="img" />;
    case "read":
      return <CheckCheck className={cn(common, "text-primary")} aria-label={label} role="img" />;
    case "failed":
      return (
        <AlertCircle className={cn(common, "text-destructive")} aria-label={label} role="img" />
      );
  }
}
