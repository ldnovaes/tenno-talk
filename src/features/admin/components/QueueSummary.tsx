import { useTranslation } from "react-i18next";

const SHOWN = ["pending", "running", "waiting_provider", "failed"] as const;

export function QueueSummary({ queue }: { queue: Record<string, number> }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 font-semibold">{t("admin.ai.queueTitle")}</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SHOWN.map((status) => (
          <div key={status} className="rounded-xl bg-muted p-3">
            <dt className="text-xs text-muted-foreground">{t(`admin.ai.queue.${status}`)}</dt>
            <dd className="text-xl font-semibold tabular-nums">{queue[status] ?? 0}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
