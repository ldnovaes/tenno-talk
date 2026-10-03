import { Trans } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/router/paths";

type LegalKey = "auth.legalNotice" | "onboarding.welcome.accept";

/** Sentence with inline links to the Terms of Use and the Privacy Policy. */
export function LegalLinks({ i18nKey }: { i18nKey: LegalKey }) {
  const linkClass = "font-medium text-primary underline-offset-2 hover:underline";
  return (
    <Trans
      i18nKey={i18nKey}
      components={{
        terms: <Link to={paths.terms()} target="_blank" className={linkClass} />,
        privacy: <Link to={paths.privacy()} target="_blank" className={linkClass} />,
      }}
    />
  );
}
