import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { AvatarPicker } from "@/components/common/AvatarPicker";
import { CountrySelect } from "@/components/common/CountrySelect";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/errors";
import { OnboardingLayout } from "@/layouts/OnboardingLayout";
import type { CurrentUser } from "@/types/user";

import { useCompleteOnboarding } from "../../hooks/useOnboardingMutations";
import { profileFormSchema, type ProfileFormValues } from "@/features/profile/lib/profileSchema";
import { useOnboardingDraftStore } from "../../stores/onboardingDraftStore";
import { StepHeading } from "../StepHeading";
import { UsernameField } from "@/features/profile/components/UsernameField";
import type { StepProps } from "./stepProps";

export function ProfileStep({ me, position, onNext }: StepProps & { me: CurrentUser }) {
  const { t } = useTranslation();
  const draft = useOnboardingDraftStore();
  const complete = useCompleteOnboarding();
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: draft.displayName,
      username: draft.username,
      bio: draft.bio,
      country: draft.country,
    },
  });

  async function submit(values: ProfileFormValues) {
    draft.update(values);
    if (!draft.nativeLanguage || !draft.receivingLanguage) return;
    try {
      await complete.mutateAsync({
        nativeLanguage: draft.nativeLanguage,
        receivingLanguage: draft.receivingLanguage,
        displayName: values.displayName,
        username: values.username,
        bio: values.bio || null,
        country: values.country,
        avatarUrl: draft.avatarUrl,
      });
      onNext();
    } catch (error) {
      const appError = toAppError(error);
      const usernameProblem = appError.fieldErrors["username"];
      form.setError(usernameProblem ? "username" : "root", {
        message: usernameProblem ? `validation.username.${usernameProblem}` : appError.message,
      });
    }
  }

  const displayName = form.watch("displayName");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="contents" noValidate>
        <OnboardingLayout
          {...position}
          footer={
            <Button type="submit" size="lg" className="w-full" disabled={complete.isPending}>
              {t("common.continue")}
            </Button>
          }
        >
          <StepHeading
            title={t("onboarding.profile.title")}
            description={t("onboarding.profile.description")}
          />
          <div className="flex flex-col gap-5">
            <AvatarPicker
              userId={me.id}
              displayName={displayName}
              value={draft.avatarUrl}
              onChange={(avatarUrl) => draft.update({ avatarUrl })}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.profile.displayName")}</FormLabel>
                  <FormControl>
                    <Input autoComplete="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => <UsernameField field={field} />}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("onboarding.profile.country")}</FormLabel>
                  <CountrySelect
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t("onboarding.profile.countryPlaceholder")}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("onboarding.profile.bio")}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({t("onboarding.profile.bioOptional")})
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={3} maxLength={160} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p role="alert" className="text-sm font-medium text-destructive">
                {form.formState.errors.root.message}
              </p>
            )}
          </div>
        </OnboardingLayout>
      </form>
    </Form>
  );
}
