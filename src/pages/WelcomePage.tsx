import { useTranslation } from "react-i18next";

import { LegalLinks } from "@/components/common/LegalLinks";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { DemoAccounts } from "@/features/auth/components/DemoAccounts";
import { SignInOptions } from "@/features/auth/components/SignInOptions";
import { TranslationDemo } from "@/features/auth/components/TranslationDemo";
import { AuthLayout } from "@/layouts/AuthLayout";
import { env } from "@/lib/env";

export default function WelcomePage() {
  const { t } = useTranslation();
  return (
    <AuthLayout>
      <div className="flex flex-1 flex-col gap-6 p-6">
        <AuthHeader title={t("auth.welcomeTitle")} subtitle={t("auth.welcomeSubtitle")} />
        <TranslationDemo />
        <div className="mt-auto flex flex-col gap-6">
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
