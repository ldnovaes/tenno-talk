import type { ReactNode } from "react";

/** Read-only row with an optional action on the right. */
export function SettingsItem({
  label,
  value,
  action,
}: {
  label: string;
  value?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <span className="block font-medium">{label}</span>
        {value !== undefined && (
          <span className="block truncate text-sm text-muted-foreground">{value}</span>
        )}
      </div>
      {action}
    </div>
  );
}
