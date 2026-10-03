import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { useOverlayNavigate } from "@/app/router/overlay";
import { isSettingsSection, paths, type SettingsSection } from "@/app/router/paths";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/features/auth/hooks/useAuthActions";
import { SettingsNav } from "@/features/settings/components/SettingsNav";
import { SettingsSectionView } from "@/features/settings/components/SettingsSectionView";
import { usePanel } from "@/layouts/panelContext";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { section } = useParams();
  const navigate = useNavigate();
  const overlayNavigate = useOverlayNavigate();
  const panel = usePanel();
  const signOut = useSignOut();

  // Inside the desktop side panel, sections replace each other (no stacked history).
  const goTo = (next?: SettingsSection) =>
    panel
      ? overlayNavigate(paths.settings(next), { replace: true })
      : navigate(paths.settings(next));

  if (isSettingsSection(section)) {
    return <SettingsSectionView section={section} onBack={() => goTo()} />;
  }

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={t("settings.title")} onBack={panel ? panel.close : () => navigate(-1)} />
      <SettingsNav onSelect={goTo} />
      <div className="mt-auto p-4">
        <Button
          variant="outline"
          className="w-full text-destructive"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          <LogOut className="size-4" aria-hidden />
          {t("auth.signOut")}
        </Button>
      </div>
    </div>
  );
}
