import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";

/** Temporary screen for routes implemented in later phases. */
export function PlaceholderScreen({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={name} />
      <EmptyState
        icon={Construction}
        title={t("placeholder.title")}
        description={t("placeholder.description")}
        className="flex-1"
      />
    </div>
  );
}
