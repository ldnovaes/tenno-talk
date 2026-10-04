/* Push only: authenticated HTTP responses are never cached by this worker. */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  event.waitUntil(
    (async () => {
      const data = event.data.json();
      const url = new URL(data.url || "/notifications", self.location.origin);
      if (url.origin !== self.location.origin) return;
      await self.registration.showNotification(data.title || "TENNO TALK", {
        body: data.body || "You have new activity.",
        icon: "/icons/icon-192.png?v=20261004",
        badge: "/favicon.png?v=20261004",
        tag: data.notificationId,
        data: { url: url.pathname + url.search, userId: data.userId },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const data = event.notification.data;
      const url = new URL(data?.url || "/notifications", self.location.origin);
      if (url.origin !== self.location.origin) return;
      // The app verifies account identity before following this destination.
      url.searchParams.set("pushUser", data?.userId || "");
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate(url.href);
        await existing.focus();
      } else await self.clients.openWindow(url.href);
    })(),
  );
});
