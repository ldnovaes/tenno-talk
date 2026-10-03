import { describe, expect, it } from "vitest";

import { firstIncompleteStep } from "@/features/onboarding/lib/firstIncompleteStep";
import { env } from "@/lib/env";

const fresh = { termsAcceptedVersion: null, onboardingCompletedAt: null };
const accepted = { termsAcceptedVersion: env.termsVersion, onboardingCompletedAt: null };
const empty = { nativeLanguage: null, receivingLanguage: null };

describe("firstIncompleteStep", () => {
  it("starts at welcome until the current terms are accepted", () => {
    expect(firstIncompleteStep(fresh, empty)).toBe("welcome");
    expect(firstIncompleteStep({ ...fresh, termsAcceptedVersion: "2020-01-01" }, empty)).toBe(
      "welcome",
    );
  });

  it("walks through languages then profile", () => {
    expect(firstIncompleteStep(accepted, empty)).toBe("native-language");
    expect(
      firstIncompleteStep(accepted, { nativeLanguage: "pt-BR", receivingLanguage: null }),
    ).toBe("receive-language");
    expect(
      firstIncompleteStep(accepted, { nativeLanguage: "pt-BR", receivingLanguage: "pt-BR" }),
    ).toBe("profile");
  });

  it("only allows discover once onboarding is complete", () => {
    expect(firstIncompleteStep({ ...accepted, onboardingCompletedAt: "2026-01-01" }, empty)).toBe(
      "discover",
    );
  });
});
