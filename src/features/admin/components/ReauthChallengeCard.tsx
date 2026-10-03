import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import type { ReauthChallenge } from "@/types/admin";

import { providerName } from "../lib/providers";

/** What the admin needs to finish the device login from the phone. */
export function ReauthChallengeCard({ challenge }: { challenge: ReauthChallenge }) {
  const { t } = useTranslation();
  return (
    <section
      aria-live="polite"
      className="space-y-3 rounded-2xl border border-primary/40 bg-accent/40 p-4"
    >
      <h2 className="font-semibold">
        {t("admin.ai.challengeTitle", { provider: providerName(challenge.provider) })}
      </h2>
      {challenge.verificationUrl ? (
        <>
          <p className="text-sm text-muted-foreground">{t("admin.ai.challengeSteps")}</p>
          {challenge.userCode && (
            <p className="font-mono text-2xl font-semibold tracking-widest" dir="ltr">
              {challenge.userCode}
            </p>
          )}
          <Button asChild size="sm">
            <a href={challenge.verificationUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden />
              {t("admin.ai.openLink")}
            </a>
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("admin.ai.challengeNoLink")}</p>
          <pre className="max-h-48 overflow-auto rounded-lg bg-muted p-3 text-xs" dir="ltr">
            {challenge.output.join("\n")}
          </pre>
        </>
      )}
    </section>
  );
}
