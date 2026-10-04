import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { prepare, signInAsDemo } from "./support";

/** No serious or critical WCAG 2.1 AA violations on the main screens, in both themes (PLAN.md §20). */
const SCREENS = [
  "/chats",
  "/chats/conv_lucas_cam",
  "/discover",
  "/feed",
  "/notifications",
  "/settings",
  "/u/cam",
];

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .flatMap((v) =>
      v.nodes.map((n) => `${v.id}: ${n.html.slice(0, 120)} — ${n.failureSummary ?? ""}`),
    );
}

for (const theme of ["light", "dark"] as const) {
  test(`main screens are accessible (${theme})`, async ({ page, context }) => {
    await prepare(context);
    await context.addInitScript((value) => {
      localStorage.setItem(
        "tenno.device-preferences",
        JSON.stringify({ state: { theme: value }, version: 1 }),
      );
    }, theme);
    // Audit the settled UI: fades (e.g. the welcome demo) would be sampled mid-animation.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/welcome");
    await page.waitForLoadState("networkidle");
    expect(await audit(page), "/welcome").toEqual([]);
    await signInAsDemo(page, "Lucas");
    for (const path of SCREENS) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      expect(await audit(page), path).toEqual([]);
    }
  });
}
