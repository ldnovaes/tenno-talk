import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";

import { useOverlayNavigate } from "@/app/router/overlay";
import { isSettingsSection, paths } from "@/app/router/paths";
import { PageHeader } from "@/components/common/PageHeader";
import { PlaceholderScreen } from "@/components/common/PlaceholderScreen";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/features/auth/hooks/useAuthActions";
import { SettingsNav } from "@/features/settings/components/SettingsNav";
import { usePanel } from "@/layouts/panelContext";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { section } = useParams();
  const navigate = useNavigate();
  const overlayNavigate = useOverlayNavigate();
  const panel = usePanel();
  const signOut = useSignOut();

  if (isSettingsSection(section))
    return <PlaceholderScreen name={t(`settings.sections.${section}`)} />;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <PageHeader title={t("settings.title")} onBack={panel ? panel.close : () => navigate(-1)} />
      <SettingsNav
        onSelect={(next) =>
          panel ? overlayNavigate(paths.settings(next)) : navigate(paths.settings(next))
        }
      />
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
