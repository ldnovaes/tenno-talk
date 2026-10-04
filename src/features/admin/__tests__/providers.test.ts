import { describe, expect, it } from "vitest";

import { canCheck, providerName, providerTone } from "../lib/providers";

describe("providers", () => {
  it("names the API providers", () => {
    expect(providerName("openai")).toBe("OpenAI");
    expect(providerName("anthropic")).toBe("Anthropic");
    expect(providerName("other")).toBe("other");
  });

  it("maps states to tones", () => {
    expect(providerTone("ok")).toBe("ok");
    expect(providerTone("cooling_down")).toBe("warning");
    expect(providerTone("invalid_key")).toBe("danger");
    expect(providerTone("not_configured")).toBe("danger");
  });

  it("checks only providers that have a key", () => {
    expect(canCheck("ok")).toBe(true);
    expect(canCheck("invalid_key")).toBe(true);
    expect(canCheck("cooling_down")).toBe(true);
    expect(canCheck("not_configured")).toBe(false);
  });
});
