import { Trans, useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { paths } from "@/app/router/paths";
import { PageHeader } from "@/components/common/PageHeader";
import { AuthHeader } from "@/features/auth/components/AuthHeader";
import { PasswordForm } from "@/features/auth/components/PasswordForm";
import { usePasswordSignIn } from "@/features/auth/hooks/useAuthActions";
import { AuthLayout } from "@/layouts/AuthLayout";

export default function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const signIn = usePasswordSignIn();
  return (
    <AuthLayout>
      <PageHeader title="" onBack={() => navigate(paths.welcome())} className="border-none" />
      <div className="flex flex-col gap-6 px-6 pb-6">
        <AuthHeader title={t("auth.signInTitle")} subtitle={t("auth.signInSubtitle")} />
        <PasswordForm mode="signin" pending={signIn.isPending} onSubmit={signIn.mutateAsync} />
        <p className="text-center text-sm text-muted-foreground">
          <Trans
            i18nKey="auth.noAccount"
            components={{ link: <Link to={paths.signUp()} className="font-medium text-primary" /> }}
          />
        </p>
      </div>
    </AuthLayout>
  );
}
