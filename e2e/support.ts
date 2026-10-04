import {
  expect,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

/** Mock knobs (src/services/mock/latency.ts): fast and deterministic. */
const MOCK_CONFIG = {
  minLatencyMs: 20,
  maxLatencyMs: 60,
  failureRate: 0,
  translationFailureRate: 0,
  improvedTranslationRate: 0,
  translationDelayMs: 200,
  autoReply: false,
};

export async function prepare(context: BrowserContext) {
  await context.addInitScript((config) => {
    localStorage.setItem("tenno.mock-config", JSON.stringify(config));
  }, MOCK_CONFIG);
}

/** Demo accounts (mock): the session is per tab, so each tab is one person. */
export async function signInAsDemo(page: Page, name: "Lucas" | "Cam") {
  await page.goto("/welcome");
  await page.getByRole("button", { name: `Sign in as ${name}` }).click();
  await expect(page).toHaveURL(/\/chats/);
}

/**
 * Two people on the mock backend: two tabs of the same browser, which share the mock
 * database (localStorage) and its event channel (BroadcastChannel).
 */
export async function twoPeople(browser: Browser, project: TestInfo["project"]["use"]) {
  // Same device as the project (desktop or phone), without undefined keys (exactOptionalPropertyTypes).
  const device = Object.fromEntries(
    (["viewport", "userAgent", "deviceScaleFactor", "isMobile", "hasTouch"] as const)
      .filter((key) => project[key] !== undefined)
      .map((key) => [key, project[key]]),
  );
  const context = await browser.newContext(device);
  await prepare(context);
  const lucas = await context.newPage();
  const cam = await context.newPage();
  await signInAsDemo(lucas, "Lucas");
  await signInAsDemo(cam, "Cam");
  return { context, lucas, cam };
}

export function openChatWith(page: Page, name: RegExp) {
  return page.getByRole("list", { name: "Chats" }).getByRole("link", { name }).click();
}

/** Sends with the button: on touch keyboards Enter inserts a new line. */
export async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: /message/i }).fill(text);
  await page.getByRole("button", { name: "Send" }).click();
}

/** A bubble pinned by its id, so it stays found when its text switches language. */
export async function bubbleWith(log: Locator, text: string): Promise<Locator> {
  const bubble = log.locator("[id^=message-]").filter({ hasText: text }).first();
  const id = await bubble.getAttribute("id");
  return log.locator(`[id="${id}"]`);
}
