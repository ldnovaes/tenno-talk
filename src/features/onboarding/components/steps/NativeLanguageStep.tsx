import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { LanguagePicker } from "@/components/common/LanguagePicker";
import { Button } from "@/components/ui/button";
import { detectSystemLanguage } from "@/lib/languages";
import { OnboardingLayout } from "@/layouts/OnboardingLayout";

import { useOnboardingDraftStore } from "../../stores/onboardingDraftStore";
import { StepHeading } from "../StepHeading";
import type { StepProps } from "./stepProps";

export function NativeLanguageStep({ position, onNext }: StepProps) {
  const { t } = useTranslation();
  const nativeLanguage = useOnboardingDraftStore((state) => state.nativeLanguage);
  const update = useOnboardingDraftStore((state) => state.update);
  const detected = detectSystemLanguage();

  // Pre-select the device language (PLAN.md §34, decision 4).
  useEffect(() => {
    if (!nativeLanguage) update({ nativeLanguage: detected });
  }, [nativeLanguage, detected, update]);

  return (
    <OnboardingLayout
      {...position}
      footer={
        <Button size="lg" className="w-full" disabled={!nativeLanguage} onClick={onNext}>
          {t("common.continue")}
        </Button>
      }
    >
      <StepHeading
        title={t("onboarding.native.title")}
        description={t("onboarding.native.description")}
      />
      <LanguagePicker
        label={t("onboarding.native.title")}
        value={nativeLanguage}
        onChange={(code) => update({ nativeLanguage: code, receivingLanguage: null })}
        hint={{ code: detected, text: t("onboarding.native.detected") }}
        className="flex-1"
      />
    </OnboardingLayout>
  );
}
