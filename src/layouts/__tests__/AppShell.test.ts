import { describe, expect, it } from "vitest";

import { hidesBottomNav } from "@/layouts/shellRoutes";

describe("hidesBottomNav", () => {
  it.each(["/chats/conv_1", "/settings/privacy", "/u/linh/edit", "/create", "/notifications"])(
    "hides on %s",
    (path) => expect(hidesBottomNav(path)).toBe(true),
  );
  it.each(["/chats", "/discover", "/feed", "/u/linh", "/settings"])("shows on %s", (path) =>
    expect(hidesBottomNav(path)).toBe(false),
  );
});
