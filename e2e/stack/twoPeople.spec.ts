import { expect, test } from "@playwright/test";
import { signUpAndOnboard } from "./support";

/** Two real accounts through Caddy: TLS, CSP, WebSocket, upload and cookies as in production. */
const PNG_8x8 =
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGMwnvAGK2IYWhIA6+9rwT6p4IQAAAAASUVORK5CYII=";

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
