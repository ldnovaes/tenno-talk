import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

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
import { toAppError } from "@/lib/errors";
import type { PasswordCredentials } from "@/services/authService";

function buildSchema(mode: "signin" | "signup") {
  const base = z.object({
    email: z.string().trim().email("auth.validation.email"),
    password: z.string().min(mode === "signup" ? 8 : 1, "auth.validation.passwordLength"),
    confirmPassword: z.string(),
  });
  return mode === "signup"
    ? base.refine((value) => value.password === value.confirmPassword, {
        message: "auth.validation.passwordsMatch",
        path: ["confirmPassword"],
      })
    : base;
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

interface PasswordFormProps {
  mode: "signin" | "signup";
  pending: boolean;
  onSubmit: (credentials: PasswordCredentials) => Promise<unknown>;
}

/** Email + password form shared by sign-in and sign-up. */
export function PasswordForm({ mode, pending, onSubmit }: PasswordFormProps) {
  const { t } = useTranslation();
  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(mode)),
    defaultValues: { email: "", password: "", confirmPassword: "" },
  });

  async function submit(values: FormValues) {
    try {
      await onSubmit({ email: values.email, password: values.password });
    } catch (error) {
      const appError = toAppError(error);
      const field = appError.fieldErrors["email"] ? "email" : "password";
      form.setError(field, { message: appError.message });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.email")}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" inputMode="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("auth.password")}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {mode === "signup" && (
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("auth.confirmPassword")}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button type="submit" size="lg" disabled={pending}>
          {mode === "signup" ? t("auth.signUp") : t("auth.signIn")}
        </Button>
      </form>
    </Form>
  );
}
