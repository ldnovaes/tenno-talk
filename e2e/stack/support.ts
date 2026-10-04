import { expect, type Browser, type Page } from "@playwright/test";

function watch(page: Page, problems: string[]) {
  page.on("console", (m) => {
    if (m.type() === "error" || /Content Security Policy/i.test(m.text())) problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
}

export async function signUpAndOnboard(
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
