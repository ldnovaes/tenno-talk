import { useId, type ReactNode } from "react";

import { Switch } from "@/components/ui/switch";

/** Labelled switch row: saves immediately (optimistic). */
export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-muted-foreground">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="py-2">
      {title && <h2 className="px-4 pb-1 pt-2 text-sm font-semibold text-primary">{title}</h2>}
      <div className="divide-y divide-border/60">{children}</div>
    </section>
  );
}
