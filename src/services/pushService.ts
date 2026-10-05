import { needsHomeScreenInstall } from "@/lib/platform";

import { http } from "./http/httpClient";

export const pushService = {
  supported: () =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window,
  /** "default" also where the API is missing (iPhone/iPad outside the Home Screen). */
  permission: (): NotificationPermission =>
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default",
  needsInstall: () =>
    typeof window !== "undefined" &&
    needsHomeScreenInstall(
      navigator.userAgent,
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
        ("standalone" in navigator && navigator.standalone === true),
    ),
  config: () =>
    __USE_HTTP__
      ? http<{ enabled: boolean; publicKey: string }>("GET", "/api/push/config")
      : Promise.resolve({ enabled: false, publicKey: "" }),
  async status() {
    if (!this.supported()) return false;
    const registration = await navigator.serviceWorker.getRegistration("/");
    return !!(await registration?.pushManager.getSubscription());
  },
  async enable(publicKey: string) {
    if (!publicKey || !this.supported()) throw new Error("Push unavailable");
    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Permission denied");
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    const registration = await navigator.serviceWorker.ready;
    const encoded = publicKey.replace(/-/g, "+").replace(/_/g, "/");
    const key = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      }));
    try {
      await http<void>("POST", "/api/push/subscriptions", { body: subscription.toJSON() });
    } catch (error) {
      await subscription.unsubscribe();
      throw error;
    }
  },
  async disable() {
    if (!this.supported()) return;
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    try {
      if (subscription) {
        try {
          await http<void>("DELETE", "/api/push/subscriptions", {
            body: { endpoint: subscription.endpoint },
          });
        } finally {
          await subscription.unsubscribe();
        }
      }
    } finally {
      (await registration?.getNotifications())?.forEach((notification) => notification.close());
    }
  },
};
