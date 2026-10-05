import { describe, expect, it } from "vitest";

import { authService } from "@/services/authService";
import { fakeServer } from "@/test/fakeServer";

describe("httpAuthService (wire contract)", () => {
  it("is the facade's implementation in the http build", () => {
    fakeServer.on("GET", "/api/auth/session", { body: { userId: "u1" } });
    return expect(authService.getSession()).resolves.toEqual({ userId: "u1" });
  });

  it("maps a session without user to null", async () => {
    fakeServer.on("GET", "/api/auth/session", { body: { userId: null } });
    await expect(authService.getSession()).resolves.toBeNull();
  });

  it("offers only the providers the app knows", async () => {
    fakeServer.on("GET", "/api/auth/providers", {
      body: { providers: ["facebook", "github", "google", "apple"] },
    });
    await expect(authService.getOAuthProviders()).resolves.toEqual(["facebook", "google"]);
  });

  it.each([
    ["signInWithPassword", "/api/auth/signin"],
    ["signUp", "/api/auth/signup"],
  ] as const)("%s posts the credentials with CSRF to %s", async (method, path) => {
    fakeServer.on("POST", path, { body: { userId: "u1" } });
    const credentials = { email: "a@b.co", password: "secret123" };
    await expect(authService[method](credentials)).resolves.toEqual({ userId: "u1" });
    const request = fakeServer.last(path);
    expect(request?.body).toEqual(credentials);
    expect(request?.headers["x-xsrf-token"]).toBe("csrf-token");
    expect(request?.headers["content-type"]).toBe("application/json");
  });

  it("sign-in failure keeps the server's detail and field errors", async () => {
    fakeServer.on("POST", "/api/auth/signup", {
      status: 409,
      body: { code: "conflict", detail: "Email taken", fieldErrors: { email: "taken" } },
    });
    await expect(authService.signUp({ email: "a@b.co", password: "x" })).rejects.toMatchObject({
      code: "conflict",
      message: "Email taken",
      fieldErrors: { email: "taken" },
    });
  });

  it("signs out and changes the password without a body where none is needed", async () => {
    fakeServer.on("POST", "/api/auth/signout");
    fakeServer.on("POST", "/api/auth/password");
    await authService.signOut();
    await authService.changePassword({ current: null, next: "newpassword" });
    expect(fakeServer.last("/api/auth/signout")?.headers["content-type"]).toBeUndefined();
    expect(fakeServer.last("/api/auth/password")?.body).toEqual({
      current: null,
      next: "newpassword",
    });
  });

  it("demo accounts are refused without calling the server", async () => {
    await expect(authService.signInAsDemo("usr_linh")).rejects.toMatchObject({ code: "forbidden" });
    expect(fakeServer.requests).toHaveLength(0);
  });
});
