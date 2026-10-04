import { expect, test, type Browser, type Page } from "@playwright/test";

/** Two real accounts through Caddy: TLS, CSP, WebSocket, upload and cookies as in production. */
const PNG_8x8 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGMwnvAGK2IYWhIA6+9rwT6p4IQAAAAASUVORK5CYII=";

function watch(page: Page, problems: string[]) {
  page.on("console", (m) => {
    if (m.type() === "error" || /Content Security Policy/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
}

async function signUpAndOnboard(
  browser: Browser,
  name: string,
  locale: string,
  country: RegExp,
  problems: string[],
) {
  const context = await browser.newContext({ locale, ignoreHTTPSErrors: true });
  const page = await context.newPage();
  watch(page, problems);
  const username = `${name.toLowerCase()}${Date.now() % 100000}`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("secret123");
  await page.getByLabel("Confirm password").fill("secret123");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Username", { exact: true }).fill(username);
  await expect(page.getByText("Username available")).toBeVisible();
  await page.getByRole("combobox", { name: "Country" }).click();
  await page.getByRole("option", { name: country }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: "Start chatting" }).click();
  await expect(page).toHaveURL(/\/chats/);
  return { context, page, username };
}

test("two people chat, send a photo and stay within the CSP", async ({ browser }) => {
  const problems: string[] = [];
  const rafael = await signUpAndOnboard(browser, "Rafael", "pt-BR", /^Bra[sz]il$/, problems);
  const linh = await signUpAndOnboard(browser, "Linh", "vi-VN", /Vi[eệ]t ?Nam/i, problems);

  await linh.page.goto(`/u/${rafael.username}`);
  await linh.page.getByRole("button", { name: "Message" }).click();
  await expect(linh.page.getByText(/Say hi to Rafael/)).toBeVisible();
  await linh.page.getByRole("textbox", { name: /message/i }).fill("Chào anh!");
  await linh.page.getByRole("button", { name: "Send" }).click();

  // Live over wss://, no reload.
  await expect(rafael.page.getByText("Chào anh!").first()).toBeVisible();
  await expect(linh.page.getByRole("img", { name: "Delivered" }).last()).toBeVisible();

  await linh.page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "dot.png",
      mimeType: "image/png",
      buffer: Buffer.from(PNG_8x8, "base64"),
    });
  await linh.page.getByRole("button", { name: "Send" }).click();
  await rafael.page
    .getByRole("list", { name: "Chats" })
    .getByRole("link", { name: /Linh/ })
    .click();
  const photo = rafael.page
    .getByRole("log", { name: "Messages" })
    .locator('img[src^="/api/media/"]')
    .last();
  await expect(photo).toBeVisible();
  expect(
    await photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
  ).toBe(true);

  const session = (await linh.context.cookies()).find((cookie) => cookie.name === "SESSION");
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });
  expect(problems).toEqual([]);
});
