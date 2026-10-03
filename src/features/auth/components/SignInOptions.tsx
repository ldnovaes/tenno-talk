import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/router/paths";
import { Button } from "@/components/ui/button";

import { useOAuthSignIn } from "../hooks/useAuthActions";
import { FacebookIcon, GoogleIcon } from "./BrandIcons";

export function SignInOptions() {
  const { t } = useTranslation();
  const oauth = useOAuthSignIn();
  return (
    <div className="flex flex-col gap-2.5">
      <Button
        variant="outline"
        size="lg"
        className="gap-3"
        disabled={oauth.isPending}
        onClick={() => oauth.mutate("google")}
      >
        <GoogleIcon className="size-5" />
        {t("auth.continueWithGoogle")}
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="gap-3"
        disabled={oauth.isPending}
        onClick={() => oauth.mutate("facebook")}
      >
        <FacebookIcon className="size-5" />
        {t("auth.continueWithFacebook")}
      </Button>
      <Button asChild size="lg" className="gap-3">
        <Link to={paths.signIn()}>
          <Mail className="size-5" aria-hidden />
          {t("auth.continueWithEmail")}
        </Link>
      </Button>
    </div>
  );
}
