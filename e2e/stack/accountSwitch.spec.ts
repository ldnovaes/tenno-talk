import { expect, test } from "@playwright/test";
import { pendingSends, signIn, signOut, signUpAndOnboard } from "./support";

/**
 * Signing out with an unsent message (PLAN_UX §3.1 item 8): the send stays on the device, another
 * account signing in on the same browser never sees or sends it, and it goes out once when its own
 * account comes back.
 */
test("a pending send waits through another account's session and resumes for its owner", async ({
  browser,
}) => {
  const ana = await signUpAndOnboard(browser, "Ana", "pt-BR", /^Bra[sz]il$/, []);
  const bo = await signUpAndOnboard(browser, "Bo", "vi-VN", /Vi[eệ]t ?Nam/i, []);
  const page = ana.page;
  try {
    await page.goto(`/u/${bo.username}`);
    await page.getByRole("button", { name: "Message" }).click();
    await page.route("**/api/conversations/*/messages", (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );
    const text = `Waiting for Ana ${Date.now()}`;
    await page.getByRole("textbox", { name: /message/i }).fill(text);
    await page.getByRole("button", { name: "Send" }).click();
    await expect.poll(() => pendingSends(page).then((sends) => sends.length)).toBe(1);
    const [queued] = await pendingSends(page);

    await page.goto("/settings");
    await expect(
      page.getByText(
        "Unsent messages stay on this device and resume when you sign in to this account again.",
      ),
    ).toBeVisible();
    await signOut(page);
    await page.unroute("**/api/conversations/*/messages");

    // Bo signs in on Ana's browser and sends a message of their own: that send proves Bo's outbox ran.
    await signIn(page, bo.username);
    await page.goto(`/u/${ana.username}`);
    await page.getByRole("button", { name: "Message" }).click();
    const log = page.getByRole("log", { name: "Messages" });
    await expect(log.getByText(text)).toHaveCount(0);
    await page.getByRole("textbox", { name: /message/i }).fill("Bo on Ana's laptop");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(log.getByText("Bo on Ana's laptop")).toBeVisible();
    await expect.poll(() => pendingSends(page)).toEqual([queued]);
    await bo.page.goto(page.url());
    await expect(
      bo.page.getByRole("log", { name: "Messages" }).getByText("Bo on Ana's laptop"),
    ).toBeVisible();
    await expect(bo.page.getByText(text)).toHaveCount(0);

    await signOut(page);
    await signIn(page, ana.username);
    await expect.poll(() => pendingSends(page), { timeout: 20000 }).toEqual([]);
    await expect(bo.page.getByRole("log", { name: "Messages" }).getByText(text)).toHaveCount(1);
  } finally {
    await ana.context.close();
    await bo.context.close();
  }
});
