import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderApp } from "@/test/utils";

describe("email + password", () => {
  it("validates the sign-up form", async () => {
    renderApp("/signup");
    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Use at least 8 characters.")).toBeInTheDocument();
  });

  it("requires matching passwords", async () => {
    renderApp("/signup");
    await userEvent.type(await screen.findByLabelText("Email"), "maria@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "secret999");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Passwords don't match.")).toBeInTheDocument();
  });

  it("shows the server error for a duplicate email", async () => {
    renderApp("/signup");
    await userEvent.type(await screen.findByLabelText("Email"), "linh@demo.tenno.talk");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByText("An account with this email already exists."),
    ).toBeInTheDocument();
  });

  it("creates an account and starts onboarding", async () => {
    renderApp("/signup");
    await userEvent.type(await screen.findByLabelText("Email"), "maria@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "secret123");
    await userEvent.type(screen.getByLabelText("Confirm password"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByRole("heading", { name: "Welcome to TENNO TALK" }),
    ).toBeInTheDocument();
  });

  it("rejects wrong credentials and signs in with the right ones", async () => {
    renderApp("/signin");
    await userEvent.type(await screen.findByLabelText("Email"), "linh@demo.tenno.talk");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Password"));
    await userEvent.type(screen.getByLabelText("Password"), "demo1234");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Chats" })).toBeInTheDocument();
  });
});
