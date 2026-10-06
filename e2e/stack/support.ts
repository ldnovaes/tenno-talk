import { expect, type Browser, type Locator, type Page } from "@playwright/test";

export { expectBadge } from "../support";

/** An 8×8 PNG: the smallest real photo the media pipeline accepts. */
export const PNG_8x8 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGMwnvAGK2IYWhIA6+9rwT6p4IQAAAAASUVORK5CYII=";

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

/** Publishes a photo post through the UI and waits until it is posted. */
export async function publishPost(page: Page, caption: string) {
  await page.goto("/create");
  await page.getByLabel("Select photos or videos").setInputFiles({
    name: "post.png",
    mimeType: "image/png",
    buffer: Buffer.from(PNG_8x8, "base64"),
  });
  await page.getByLabel("Caption").fill(caption);
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(page.getByText("Posted")).toBeVisible();
}

export function railLink(page: Page, name: string): Locator {
  return page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name });
}

export async function setPrivacy(page: Page, setting: string, value: string) {
  await page.goto("/settings/privacy");
  await page.getByRole("combobox", { name: setting }).click();
  await page.getByRole("option", { name: value }).click();
  await expect(page.getByRole("combobox", { name: setting })).toHaveText(value);
}

export async function follow(page: Page, username: string, expected: "Following" | "Requested") {
  await page.goto(`/u/${username}`);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(page.getByRole("button", { name: expected })).toBeVisible();
}

/** Signs in with the password `signUpAndOnboard` gave the account. */
export async function signIn(page: Page, username: string) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(`${username}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("secret123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/chats/);
}

export async function signOut(page: Page) {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).not.toHaveURL(/\/settings/);
}

/** The sends waiting in this browser's outbox (IndexedDB), for every account. */
export function pendingSends(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tenno.outbox", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return new Promise<{ userId: string; size: number }[]>((resolve) => {
      const request = db.transaction("sends").objectStore("sends").getAll();
      request.onsuccess = () =>
        resolve(
          (request.result as { userId: string; blobs?: Blob[] }[]).map((entry) => ({
            userId: entry.userId,
            size: entry.blobs?.[0]?.size ?? 0,
          })),
        );
    });
  });
}
