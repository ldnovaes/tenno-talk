import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";

import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

import "@/app/i18n";
import { useSessionStore } from "@/stores/sessionStore";

import { resetDom } from "./dom";
import { fakeServer } from "./fakeServer";

export { setPrefersDark, setViewportWidth } from "./dom";

configure({ asyncUtilTimeout: 8000 });

fakeServer.install();

beforeEach(() => {
  resetDom();
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "XSRF-TOKEN=csrf-token";
  fakeServer.reset();
  useSessionStore.setState({ status: "unknown", userId: null });
});

afterEach(() => {
  cleanup();
});
