import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { AvatarPicker } from "@/components/common/AvatarPicker";
import { CountrySelect } from "@/components/common/CountrySelect";
import { LanguageSelect } from "@/components/common/LanguageSelect";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toAppError } from "@/lib/errors";
import type { LanguageCode } from "@/types/language";
import type { CurrentUser } from "@/types/user";

import { useUpdateProfile } from "../hooks/useProfile";
import { profileFormSchema, type ProfileFormValues } from "../lib/profileSchema";
import { LearningLanguagesField } from "./LearningLanguagesField";
import { UsernameField } from "./UsernameField";

export function EditProfileForm({
  me,
  onDone,
}: {
  me: CurrentUser;
  onDone: (username: string) => void;
}) {
  const { t } = useTranslation();
  const nativeId = useId();
  const learningId = useId();
  const update = useUpdateProfile();
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl);
  const [nativeLanguage, setNativeLanguage] = useState<LanguageCode>(me.nativeLanguage);
  const [learning, setLearning] = useState<LanguageCode[]>(me.learningLanguages);
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: me.displayName,
      username: me.username,
      bio: me.bio ?? "",
      country: me.country,
    },
  });

  async function submit(values: ProfileFormValues) {
    try {
      const user = await update.mutateAsync({
        ...values,
        bio: values.bio || null,
        avatarUrl,
        nativeLanguage,
        learningLanguages: learning.filter((code) => code !== nativeLanguage),
      });
      toast.success(t("profile.edit.saved"));
      onDone(user.username);
    } catch (error) {
      const appError = toAppError(error);
      const problem = appError.fieldErrors["username"];
      form.setError(problem ? "username" : "root", {
        message: problem ? `validation.username.${problem}` : appError.message,
      });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5 p-5" noValidate>
        <AvatarPicker
          userId={me.id}
          displayName={form.watch("displayName")}
          value={avatarUrl}
          onChange={setAvatarUrl}
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
          name="bio"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("onboarding.profile.bio")}</FormLabel>
              <FormControl>
                <Textarea rows={3} maxLength={160} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="country"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("onboarding.profile.country")}</FormLabel>
              <FormControl>
                <CountrySelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("onboarding.profile.countryPlaceholder")}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2">
          <Label htmlFor={nativeId}>{t("profile.edit.nativeLanguage")}</Label>
          <LanguageSelect
            id={nativeId}
            value={nativeLanguage}
            onChange={setNativeLanguage}
            placeholder={t("profile.edit.chooseLanguage")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={learningId}>{t("profile.edit.learningLanguages")}</Label>
          <LearningLanguagesField
            id={learningId}
            value={learning}
            native={nativeLanguage}
            onChange={setLearning}
          />
        </div>
        {form.formState.errors.root && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {form.formState.errors.root.message}
          </p>
        )}
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </form>
    </Form>
  );
}
