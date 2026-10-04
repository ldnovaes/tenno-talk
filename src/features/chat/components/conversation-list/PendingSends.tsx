import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { usePendingSends } from "../../hooks/usePendingSends";

export function PendingSends() {
  const { t } = useTranslation();
  const { pending, action } = usePendingSends();
  if (!pending.data?.length) return null;
  return (
    <section
      aria-label={t("chat.pendingMessages")}
      className="max-h-48 overflow-y-auto border-b p-4 space-y-2"
    >
      <p className="text-sm font-medium" role="status">
        {t("chat.pendingMessages")}
      </p>
      {pending.data.map((entry) => (
        <div key={entry.key} className="flex items-center gap-2 text-sm">
          <p className="min-w-0 flex-1 truncate" dir="auto">
            {entry.input.text || t("chat.pendingAttachment")}
          </p>
          {entry.blocked && (
            <Button
              size="sm"
              variant="outline"
              disabled={action.isPending}
              onClick={() => action.mutate({ id: entry.key, discard: false })}
            >
              {t("common.retry")}
            </Button>
          )}
          {entry.leaseUntil < Date.now() && (
            <Button
              size="sm"
              variant="ghost"
              disabled={action.isPending}
              onClick={() => action.mutate({ id: entry.key, discard: true })}
            >
              {t("common.cancel")}
            </Button>
          )}
        </div>
      ))}
    </section>
  );
}
