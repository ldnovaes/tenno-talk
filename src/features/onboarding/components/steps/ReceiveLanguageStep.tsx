import { Languages } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { LanguagePicker } from "@/components/common/LanguagePicker";
import { Button } from "@/components/ui/button";
import { getLanguage } from "@/lib/languages";
import { OnboardingLayout } from "@/layouts/OnboardingLayout";

import { useOnboardingDraftStore } from "../../stores/onboardingDraftStore";
import { StepHeading } from "../StepHeading";
import type { StepProps } from "./stepProps";

export function ReceiveLanguageStep({ position, onNext }: StepProps) {
  const { t } = useTranslation();
  const nativeLanguage = useOnboardingDraftStore((state) => state.nativeLanguage);
  const receivingLanguage = useOnboardingDraftStore((state) => state.receivingLanguage);
  const update = useOnboardingDraftStore((state) => state.update);

  // Usually the same as the native language, but the user may pick another one.
  useEffect(() => {
    if (!receivingLanguage && nativeLanguage) update({ receivingLanguage: nativeLanguage });
  }, [receivingLanguage, nativeLanguage, update]);

  const selected = receivingLanguage ? getLanguage(receivingLanguage) : undefined;

  return (
    <OnboardingLayout
      {...position}
      footer={
        <Button size="lg" className="w-full" disabled={!receivingLanguage} onClick={onNext}>
          {t("common.continue")}
        </Button>
      }
    >
      <StepHeading
        title={t("onboarding.receive.title")}
        description={t("onboarding.receive.description")}
      />
      {selected && (
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
          <Languages className="size-4 shrink-0" aria-hidden />
          {t("onboarding.receive.preview", { language: selected.nativeName })}
        </p>
      )}
      <LanguagePicker
        label={t("onboarding.receive.title")}
        value={receivingLanguage}
        onChange={(code) => update({ receivingLanguage: code })}
        className="flex-1"
      />
    </OnboardingLayout>
  );
}
