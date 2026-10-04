import { Mail } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/router/paths";
import { Button } from "@/components/ui/button";
import type { OAuthProvider } from "@/services/authService";

import { useOAuthSignIn } from "../hooks/useAuthActions";
import { useOAuthProviders } from "../hooks/useOAuthProviders";
import { FacebookIcon, GoogleIcon } from "./BrandIcons";

const PROVIDERS = {
  google: { icon: GoogleIcon, label: "auth.continueWithGoogle" },
  facebook: { icon: FacebookIcon, label: "auth.continueWithFacebook" },
} as const satisfies Record<
  OAuthProvider,
  { icon: ComponentType<{ className?: string }>; label: string }
>;

export function SignInOptions() {
  const { t } = useTranslation();
  const oauth = useOAuthSignIn();
  const providers = useOAuthProviders();
  return (
    <div className="flex flex-col gap-2.5">
      {providers.data?.map((provider) => {
        const { icon: Icon, label } = PROVIDERS[provider];
        return (
          <Button
            key={provider}
            variant="outline"
            size="lg"
            className="gap-3"
            disabled={oauth.isPending}
            onClick={() => oauth.mutate(provider)}
          >
            <Icon className="size-5" />
            {t(label)}
          </Button>
        );
      })}
      <Button asChild size="lg" className="gap-3">
        <Link to={paths.signIn()}>
          <Mail className="size-5" aria-hidden />
          {t("auth.continueWithEmail")}
        </Link>
      </Button>
    </div>
  );
}
