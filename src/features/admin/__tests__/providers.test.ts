import { describe, expect, it } from "vitest";

import { canReauth, providerName, providerTone } from "../lib/providers";

describe("providers", () => {
  it("names the CLIs by their product", () => {
    expect(providerName("codex")).toBe("ChatGPT");
    expect(providerName("claude")).toBe("Claude");
    expect(providerName("other")).toBe("other");
  });

  it("maps states to tones", () => {
    expect(providerTone("ok")).toBe("ok");
    expect(providerTone("needs_reauth")).toBe("danger");
    expect(providerTone("reauth_pending")).toBe("warning");
    expect(providerTone("cooling_down")).toBe("warning");
  });

  it("offers login whenever the provider is not healthy", () => {
    expect(canReauth("ok")).toBe(false);
    expect(canReauth("needs_reauth")).toBe(true);
    expect(canReauth("reauth_pending")).toBe(true);
    expect(canReauth("cooling_down")).toBe(true);
  });
});
