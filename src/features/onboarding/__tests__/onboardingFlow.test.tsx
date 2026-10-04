import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockDb } from "@/services/mock/db";
import { mockAuthService } from "@/services/mock/implementations/mockAuthService";
import { renderApp } from "@/test/utils";

describe("onboarding", () => {
  it("goes from terms to chats", async () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["vi-VN", "en-US"]);
    const { userId } = await mockAuthService.startOAuth("google");
    renderApp("/onboarding/welcome");
    const user = userEvent.setup();

    // Step 1 — terms are mandatory.
    await user.click(await screen.findByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/accept the Terms of Use/);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Step 2 — native language pre-selected from the device.
    const native = await screen.findByRole("radiogroup", {
      name: "What language do you write in?",
    });
    expect(within(native).getByRole("radio", { checked: true })).toHaveTextContent("Tiếng Việt");
    expect(within(native).getByRole("radio", { checked: true })).toHaveTextContent(
      "Detected from your device",
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Step 3 — receiving language defaults to the native one, but can change.
    const receive = await screen.findByRole("radiogroup", { name: "Receive messages in…" });
    expect(within(receive).getByRole("radio", { checked: true })).toHaveTextContent("Tiếng Việt");
    await user.click(within(receive).getByRole("radio", { name: /English \(US\)/ }));
    expect(screen.getByText("Messages will appear in English (US)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Step 4 — profile with validation.
    await screen.findByRole("heading", { name: "Create your profile" });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Use 1–40 characters.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Thảo Lê");
    await user.type(screen.getByLabelText("Username"), "thao.le");
    await user.click(screen.getByRole("combobox", { name: "Country" }));
    await user.click(await screen.findByRole("option", { name: "Vietnam" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    // Step 5 — suggestions with follow.
    await screen.findByRole("heading", { name: "People you might like" });
    const follow = (await screen.findAllByRole("button", { name: "Follow" }))[0];
    if (!follow) throw new Error("no suggestions");
    await user.click(follow);
    expect(await screen.findByRole("button", { name: "Following" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start chatting" }));
    expect(await screen.findByRole("heading", { name: "Chats" })).toBeInTheDocument();

    const saved = mockDb.read().users[userId];
    expect(saved).toMatchObject({
      displayName: "Thảo Lê",
      username: "thao.le",
      country: "VN",
      nativeLanguage: "vi-VN",
    });
    expect(saved?.preferences.translation.receivingLanguage).toBe("en-US");
    await waitFor(() =>
      expect(sessionStorage.getItem("tenno.onboarding-draft")).toContain('"nativeLanguage":null'),
    );
  });

  it("rejects a taken username", async () => {
    await mockAuthService.startOAuth("google");
    renderApp("/onboarding/welcome");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "What language do you write in?" });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Receive messages in…" });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Name"), "Someone");
    await user.type(screen.getByLabelText("Username"), "linh");
    await user.click(screen.getByRole("combobox", { name: "Country" }));
    await user.click(await screen.findByRole("option", { name: "Brazil" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("This username is already taken.")).toBeInTheDocument();
  });
});
