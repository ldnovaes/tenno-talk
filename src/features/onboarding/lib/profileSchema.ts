import { z } from "zod";

import { validateUsername } from "@/lib/username";

/** Shared by onboarding and edit profile. Messages are i18n keys (see FormMessage). */
export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "validation.displayNameLength")
    .max(40, "validation.displayNameLength"),
  username: z
    .string()
    .trim()
    .superRefine((value, context) => {
      const problem = validateUsername(value);
      if (problem)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `validation.username.${problem}`,
        });
    }),
  bio: z.string().max(160, "validation.bioLength"),
  country: z.string().min(1, "validation.required"),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
