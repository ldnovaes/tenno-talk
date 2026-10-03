import { ShieldCheck } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { LegalLinks } from "@/components/common/LegalLinks";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TranslationDemo } from "@/features/auth/components/TranslationDemo";
import { env } from "@/lib/env";
import { OnboardingLayout } from "@/layouts/OnboardingLayout";
import type { CurrentUser } from "@/types/user";

import { useAcceptTerms } from "../../hooks/useOnboardingMutations";
import { StepHeading } from "../StepHeading";
import type { StepProps } from "./stepProps";

export function WelcomeStep({ me, position, onNext }: StepProps & { me: CurrentUser }) {
  const { t } = useTranslation();
  const checkboxId = useId();
  const alreadyAccepted = me.termsAcceptedVersion === env.termsVersion;
  const [accepted, setAccepted] = useState(alreadyAccepted);
  const [showError, setShowError] = useState(false);
  const acceptTerms = useAcceptTerms();

  async function handleContinue() {
    if (!accepted) {
      setShowError(true);
      return;
    }
    if (!alreadyAccepted) await acceptTerms.mutateAsync();
    onNext();
  }

  return (
    <OnboardingLayout
      {...position}
      footer={
        <Button
          size="lg"
          className="w-full"
          onClick={handleContinue}
          disabled={acceptTerms.isPending}
        >
          {t("common.continue")}
        </Button>
      }
    >
      <StepHeading
        title={t("onboarding.welcome.title")}
        description={t("onboarding.welcome.description")}
      />
      <TranslationDemo />
      <div className="mt-6 space-y-4">
        <p className="flex gap-2.5 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t("onboarding.welcome.aiNotice")}
        </p>
        <div className="flex items-start gap-3">
          <Checkbox
            id={checkboxId}
            checked={accepted}
            onCheckedChange={(value) => {
              setAccepted(value === true);
              setShowError(false);
            }}
            aria-invalid={showError}
            aria-describedby={showError ? `${checkboxId}-error` : undefined}
            className="mt-0.5"
          />
          <label htmlFor={checkboxId} className="text-sm leading-snug">
            <LegalLinks i18nKey="onboarding.welcome.accept" />
          </label>
        </div>
        {showError && (
          <p
            id={`${checkboxId}-error`}
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {t("onboarding.welcome.acceptRequired")}
          </p>
        )}
      </div>
    </OnboardingLayout>
  );
}
