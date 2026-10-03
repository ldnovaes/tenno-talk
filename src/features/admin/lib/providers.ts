import type { ProviderStateName } from "@/types/admin";

/** Display names: the product calls them by brand, the server by CLI id. */
export function providerName(id: string): string {
  if (id === "codex") return "ChatGPT";
  if (id === "claude") return "Claude";
  return id;
}

export type ProviderTone = "ok" | "warning" | "danger";

export function providerTone(state: ProviderStateName): ProviderTone {
  if (state === "ok") return "ok";
  if (state === "needs_reauth") return "danger";
  return "warning";
}

/** Login is offered whenever the provider is not healthy (also to restart a stuck login). */
export function canReauth(state: ProviderStateName): boolean {
  return state !== "ok";
}
