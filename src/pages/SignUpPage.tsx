import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { paths } from "@/app/router/paths";
import { LegalLinks } from "@/components/common/LegalLinks";
import { PageHeader } from "@/components/common/PageHeader";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { PasswordForm } from "@/features/auth/components/PasswordForm";
import { useSignUp } from "@/features/auth/hooks/useAuthActions";
import { AuthLayout } from "@/layouts/AuthLayout";

export default function SignUpPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signUp = useSignUp();
  return (
    <AuthLayout>
      <PageHeader title="" onBack={() => navigate(paths.welcome())} className="border-none" />
      <div className="flex flex-col gap-6 px-6 pb-6">
        <AuthHeader title={t("auth.signUpTitle")} subtitle={t("auth.signUpSubtitle")} />
        <PasswordForm mode="signup" pending={signUp.isPending} onSubmit={signUp.mutateAsync} />
        <p className="text-center text-sm text-muted-foreground">
          <Trans
            i18nKey="auth.haveAccount"
            components={{ link: <Link to={paths.signIn()} className="font-medium text-primary" /> }}
          />
        </p>
        <p className="text-center text-xs text-muted-foreground">
          <LegalLinks i18nKey="auth.legalNotice" />
        </p>
      </div>
    </AuthLayout>
  );
}
