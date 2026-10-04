import { CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { toast } from "sonner";

import { useOverlayNavigate } from "@/app/router/overlay";
import { paths } from "@/app/router/paths";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/useMe";
import { devService } from "@/services/devService";

import { ChangePasswordDialog } from "../ChangePasswordDialog";
import { DeleteAccountButton } from "../DeleteAccountButton";
import { ExportDataButton } from "../ExportDataButton";
import { SettingsGroup } from "../SettingsRow";
import { SettingsItem } from "../SettingsItem";

export function AccountSettings() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const overlayNavigate = useOverlayNavigate();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const hasPassword = me.connectedProviders.includes("password");
  const edit = () => overlayNavigate(paths.editProfile(me.username));

  return (
    <>
      <SettingsGroup title={t("settings.accountSection.profile")}>
        <SettingsItem
          label={me.displayName}
          value={`@${me.username}`}
          action={
            <Button size="sm" variant="secondary" onClick={edit}>
              {t("settings.accountSection.editProfile")}
            </Button>
          }
        />
        <SettingsItem
          label={t("settings.accountSection.email")}
          value={me.email ?? t("settings.accountSection.noEmail")}
        />
        <SettingsItem
          label={t("settings.accountSection.password")}
          value={hasPassword ? "••••••••" : undefined}
          action={
            <Button size="sm" variant="secondary" onClick={() => setPasswordOpen(true)}>
              {hasPassword
                ? t("settings.accountSection.changePassword")
                : t("settings.accountSection.setPassword")}
            </Button>
          }
        />
      </SettingsGroup>
      <SettingsGroup title={t("settings.accountSection.connected")}>
        {(["google", "facebook"] as const).map((provider) => {
          const connected = me.connectedProviders.includes(provider);
          return (
            <SettingsItem
              key={provider}
              label={provider === "google" ? "Google" : "Facebook"}
              value={
                connected
                  ? t("settings.accountSection.connectedYes")
                  : t("settings.accountSection.connectedNo")
              }
              action={
                connected ? (
                  <CheckCircle2 className="size-5 text-online" aria-hidden />
                ) : (
                  <Circle className="size-5 text-muted-foreground" aria-hidden />
                )
              }
            />
          );
        })}
      </SettingsGroup>
      <SettingsGroup title={t("settings.accountSection.legal")}>
        <SettingsItem
          label={t("settings.accountSection.termsAccepted", {
            version: me.termsAcceptedVersion ?? "—",
          })}
          value={
            <span className="flex gap-3">
              <Link to={paths.terms()} target="_blank" className="text-primary">
                {t("legal.terms.title")}
              </Link>
              <Link to={paths.privacy()} target="_blank" className="text-primary">
                {t("legal.privacy.title")}
              </Link>
            </span>
          }
        />
      </SettingsGroup>
      <SettingsGroup title={t("settings.accountSection.yourData")}>
        <div className="space-y-2 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t("settings.accountSection.exportDescription")}
          </p>
          <ExportDataButton />
        </div>
      </SettingsGroup>
      <SettingsGroup title={t("settings.accountSection.dangerZone")}>
        <div className="space-y-2 px-4 py-3">
          {devService.available && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                void devService.resetDemoData().then(() => {
                  toast.success(t("settings.accountSection.resetDemoDone"));
                  window.setTimeout(() => window.location.reload(), 400);
                })
              }
            >
              {t("settings.accountSection.resetDemo")}
            </Button>
          )}
          <DeleteAccountButton />
        </div>
      </SettingsGroup>
      <ChangePasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        hasPassword={hasPassword}
      />
    </>
  );
}
