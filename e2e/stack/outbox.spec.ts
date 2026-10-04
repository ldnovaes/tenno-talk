import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./support";

const IMAGE =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGMwnvAGK2IYWhIA6+9rwT6p4IQAAAAASUVORK5CYII=";

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
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("tenno.outbox", 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          return new Promise<number>((resolve) => {
            const request = db.transaction("sends").objectStore("sends").count();
            request.onsuccess = () => resolve(request.result);
          });
        }),
      )
      .toBe(1);
    await page.reload();
    await expect(page.getByRole("log", { name: "Messages" }).getByText(text)).toBeVisible();
    await page.unroute("**/api/conversations/*/messages");
    await expect
      .poll(
        async () =>
          page.evaluate(async () => {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open("tenno.outbox", 1);
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            return new Promise<number>((resolve) => {
              const request = db.transaction("sends").objectStore("sends").count();
              request.onsuccess = () => resolve(request.result);
            });
          }),
        { timeout: 20000 },
      )
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
        buffer: Buffer.from(IMAGE, "base64"),
      });
    const photoText = `Photo through reload ${Date.now()}`;
    await page.getByRole("textbox", { name: /message/i }).fill(photoText);
    await page.getByRole("button", { name: "Send" }).click();
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("tenno.outbox", 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          return new Promise<{ count: number; hasBytes: boolean }>((resolve) => {
            const request = db.transaction("sends").objectStore("sends").getAll();
            request.onsuccess = () =>
              resolve({
                count: request.result.length,
                hasBytes: (request.result[0]?.blobs?.[0]?.size ?? 0) > 0,
              });
          });
        }),
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
