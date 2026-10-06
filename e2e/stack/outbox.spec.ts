import { expect, test } from "@playwright/test";
import { PNG_8x8, pendingSends, signUpAndOnboard } from "./support";

test("a failed real message survives reload and sends once when the network recovers", async ({
  browser,
}) => {
  const sender = await signUpAndOnboard(browser, "Outboxsender", "pt-BR", /^Bra[sz]il$/, []);
  const recipient = await signUpAndOnboard(browser, "Outboxreceiver", "pt-BR", /^Bra[sz]il$/, []);
  const page = sender.page;
  try {
    await page.goto(`/u/${recipient.username}`);
    await page.getByRole("button", { name: "Message" }).click();
    await expect(page.getByRole("heading", { name: /Say hi to Outboxreceiver/ })).toBeVisible();
    await page.route("**/api/conversations/*/messages", (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );
    const text = `Queued through reload ${Date.now()}`;
    await page.getByRole("textbox", { name: /message/i }).fill(text);
    await page.getByRole("button", { name: "Send" }).click();
    await expect.poll(async () => pendingSends(page).then((sends) => sends.length)).toBe(1);
    await page.reload();
    await expect(page.getByRole("log", { name: "Messages" }).getByText(text)).toBeVisible();
    await page.unroute("**/api/conversations/*/messages");
    await expect
      .poll(async () => pendingSends(page).then((sends) => sends.length), { timeout: 20000 })
      .toBe(0);
    await expect(page.getByRole("log", { name: "Messages" }).getByText(text)).toHaveCount(1);
    await expect(recipient.page.getByText(text).first()).toBeVisible();
    await page.route("**/api/media", (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "queued.png",
        mimeType: "image/png",
        buffer: Buffer.from(PNG_8x8, "base64"),
      });
    const photoText = `Photo through reload ${Date.now()}`;
    await page.getByRole("textbox", { name: /message/i }).fill(photoText);
    await page.getByRole("button", { name: "Send" }).click();
    await expect
      .poll(async () =>
        pendingSends(page).then((sends) => ({
          count: sends.length,
          hasBytes: (sends[0]?.size ?? 0) > 0,
        })),
      )
      .toMatchObject({ count: 1, hasBytes: true });
    await page.reload();
    await page.unroute("**/api/media");
    await expect(page.getByRole("log", { name: "Messages" }).getByText(photoText)).toBeVisible();
    await expect(recipient.page.getByText(photoText).first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole("log", { name: "Messages" }).getByText(photoText)).toHaveCount(1);
  } finally {
    await sender.context.close();
    await recipient.context.close();
  }
});
