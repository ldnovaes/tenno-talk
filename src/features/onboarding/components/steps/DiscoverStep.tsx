import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowButton } from "@/features/profile/components/FollowButton";
import { PersonRow } from "@/features/profile/components/PersonRow";
import { OnboardingLayout } from "@/layouts/OnboardingLayout";

import { useSuggestions } from "../../hooks/useOnboardingMutations";
import { StepHeading } from "../StepHeading";
import type { StepProps } from "./stepProps";

export function DiscoverStep({ position, onNext }: StepProps) {
  const { t } = useTranslation();
  const suggestions = useSuggestions(6);
  return (
    <OnboardingLayout
      {...position}
      footer={
        <Button size="lg" className="w-full" onClick={onNext}>
          {t("onboarding.discover.start")}
        </Button>
      }
    >
      <StepHeading
        title={t("onboarding.discover.title")}
        description={t("onboarding.discover.description")}
      />
      <div className="divide-y">
        {suggestions.isPending &&
          ["a", "b", "c", "d"].map((key) => (
            <div key={key} className="flex items-center gap-3 py-2.5">
              <Skeleton className="size-12 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        {suggestions.data?.map((profile) => (
          <PersonRow
            key={profile.id}
            profile={profile}
            actions={<FollowButton profile={profile} />}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}
