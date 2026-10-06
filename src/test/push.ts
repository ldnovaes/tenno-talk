import { vi } from "vitest";

import { pushService } from "@/services/pushService";

/** Puts this "device" in a Web Push state for UI tests (jsdom has no PushManager). Restore with vi.restoreAllMocks(). */
export function stubPush(state: {
  supported?: boolean;
  permission?: NotificationPermission;
  needsInstall?: boolean;
  enabled?: boolean;
  subscribed?: boolean;
}) {
  let subscribed = state.subscribed ?? false;
  vi.spyOn(pushService, "supported").mockReturnValue(state.supported ?? true);
  vi.spyOn(pushService, "permission").mockReturnValue(state.permission ?? "default");
  vi.spyOn(pushService, "needsInstall").mockReturnValue(state.needsInstall ?? false);
  vi.spyOn(pushService, "config").mockResolvedValue({
    enabled: state.enabled ?? true,
    publicKey: state.enabled === false ? "" : "public-key",
  });
  vi.spyOn(pushService, "status").mockImplementation(() => Promise.resolve(subscribed));
  const enable = vi.spyOn(pushService, "enable").mockImplementation(() => {
    subscribed = true;
    return Promise.resolve();
  });
  const disable = vi.spyOn(pushService, "disable").mockImplementation(() => {
    subscribed = false;
    return Promise.resolve();
  });
  return { enable, disable };
}
