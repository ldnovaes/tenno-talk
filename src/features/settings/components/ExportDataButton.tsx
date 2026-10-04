import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

import { useExportData } from "../hooks/useExportData";

export function ExportDataButton() {
  const { t } = useTranslation();
  const exportData = useExportData();
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => exportData.mutate()}
      disabled={exportData.isPending}
    >
      <Download className="size-4" aria-hidden />
      {exportData.isPending
        ? t("settings.accountSection.exporting")
        : t("settings.accountSection.exportData")}
    </Button>
  );
}
