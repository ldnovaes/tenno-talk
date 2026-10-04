import type { ProviderStateName } from "@/types/admin";

/** Display names of the API providers (server ids: openai, anthropic). */
export function providerName(id: string): string {
  if (id === "openai") return "OpenAI";
  if (id === "anthropic") return "Anthropic";
  return id;
}

export type ProviderTone = "ok" | "warning" | "danger";

export function providerTone(state: ProviderStateName): ProviderTone {
  if (state === "ok") return "ok";
  if (state === "cooling_down") return "warning";
  return "danger";
}

/** Without a key there is nothing to check: the key must be added on the server first. */
export function canCheck(state: ProviderStateName): boolean {
  return state !== "not_configured";
}
