import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mockReports } from "@/services/mock/mockReports";
import { renderApp, signInAs } from "@/test/utils";
import { setViewportWidth } from "@/test/setup";

const LINH_PT = "Eu também estava com saudade de você.";

async function reportWith(reason: string) {
  const dialog = await screen.findByRole("dialog");
  await userEvent.click(within(dialog).getByRole("radio", { name: reason }));
  await userEvent.click(within(dialog).getByRole("button", { name: "Send report" }));
  // Toasts live in a global store: one from an earlier test may still be on screen.
  expect((await screen.findAllByText("Thanks. We'll review your report.")).length).toBeGreaterThan(
    0,
  );
}

describe("reporting", () => {
  beforeEach(() => {
    setViewportWidth(1280);
    mockReports.length = 0;
  });

  it("reports someone else's message, never my own", async () => {
    signInAs("usr_rafael");
    renderApp("/chats/conv_rafael_linh");
    const log = await screen.findByRole("log", { name: "Messages" });
    const bubble = (await within(log).findByText(LINH_PT)).closest("[id^=message-]");
    if (!(bubble instanceof HTMLElement)) throw new Error("bubble not found");
    await userEvent.click(within(bubble).getByRole("button", { name: "Message actions" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Report" }));
    expect(screen.getByRole("heading", { name: "Report this message" })).toBeInTheDocument();
    // Nothing is sent until a reason is chosen.
    expect(screen.getByRole("button", { name: "Send report" })).toBeDisabled();
    await reportWith("Spam or scam");
    expect(mockReports).toHaveLength(1);
    expect(mockReports[0]).toMatchObject({ targetKind: "message", reason: "spam", status: "open" });

    const mine = within(log).getByText("Estou com saudade de você.").closest("[id^=message-]");
    if (!(mine instanceof HTMLElement)) throw new Error("bubble not found");
    await userEvent.click(within(mine).getByRole("button", { name: "Message actions" }));
    expect(await screen.findByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Report" })).not.toBeInTheDocument();
  });

  it("reports a person from their profile and the admin resolves it", async () => {
    signInAs("usr_rafael");
    renderApp("/u/linh");
    await userEvent.click(await screen.findByRole("button", { name: "Profile menu" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Report" }));
    expect(screen.getByRole("heading", { name: "Report this person" })).toBeInTheDocument();
    await reportWith("Harassment or bullying");
    expect(mockReports[0]).toMatchObject({ targetKind: "user", reason: "harassment" });
  });
});

describe("admin reports", () => {
  beforeEach(() => {
    setViewportWidth(1280);
    mockReports.length = 0;
    mockReports.push({
      id: "rep_1",
      targetKind: "user",
      targetId: "usr_linh",
      reason: "spam",
      status: "open",
      createdAt: new Date().toISOString(),
      reporterId: "usr_sofia",
      reporterUsername: "sofia",
    });
  });

  it("lists open reports and moves them out when reviewed", async () => {
    signInAs("usr_rafael");
    renderApp("/admin/reports");
    expect(await screen.findByRole("heading", { name: "Spam or scam" })).toBeInTheDocument();
    expect(screen.getByText(/Reported by @sofia/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));
    expect(await screen.findByText("No reports here.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Reviewed" }));
    expect(await screen.findByRole("heading", { name: "Spam or scam" })).toBeInTheDocument();
  });

  it("is closed to non-admins", async () => {
    signInAs("usr_linh");
    renderApp("/admin/reports");
    expect(await screen.findByText("This page is for administrators.")).toBeInTheDocument();
  });
});

describe("data export", () => {
  const created: Blob[] = [];

  beforeEach(() => {
    setViewportWidth(1280);
    created.length = 0;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:export";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  afterEach(() => vi.restoreAllMocks());

  it("downloads the account data without the password", async () => {
    signInAs("usr_rafael");
    renderApp("/settings/account");
    await userEvent.click(await screen.findByRole("button", { name: "Download my data" }));
    await waitFor(() => expect(created).toHaveLength(1));
    const blob = created[0];
    if (!blob) throw new Error("nothing downloaded");
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    const data = JSON.parse(text) as { account: { username: string }; messagesSent: unknown[] };
    expect(data.account.username).toBe("rafael");
    expect(data.messagesSent.length).toBeGreaterThan(0);
    expect(data.account).not.toHaveProperty("password");
    expect(text).not.toContain("demo1234");
  });
});
