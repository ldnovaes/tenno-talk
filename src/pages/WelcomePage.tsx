import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { LegalLinks } from "@/components/common/LegalLinks";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { DemoAccounts } from "@/features/auth/components/DemoAccounts";
import { SignInOptions } from "@/features/auth/components/SignInOptions";
import { TranslationDemo } from "@/features/auth/components/TranslationDemo";
import { AuthLayout } from "@/layouts/AuthLayout";
import { env } from "@/lib/env";

export default function WelcomePage() {
  const { t } = useTranslation();
  // The backend sends failed Google/Facebook logins back here (SecurityConfig).
  const [params] = useSearchParams();
  const oauthFailed = params.get("error") === "oauth";
  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col gap-6 p-6">
        <AuthHeader title={t("auth.welcomeTitle")} subtitle={t("auth.welcomeSubtitle")} />
        <TranslationDemo />
        <div className="mt-auto flex flex-col gap-6">
          {oauthFailed && (
            <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {t("auth.oauthFailed")}
            </p>
          )}
          <SignInOptions />
          {env.dataSource === "mock" && <DemoAccounts />}
          <p className="text-center text-xs text-muted-foreground">
            <LegalLinks i18nKey="auth.legalNotice" />
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
