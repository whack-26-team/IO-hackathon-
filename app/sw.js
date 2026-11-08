// REMY service worker: shows lock-screen timer alerts (server/push.py sends them).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "REMY", body: e.data?.text() || "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "REMY", {
    body: d.body || "", tag: d.tag || "remy", renotify: true, icon: "/icon-192.png", badge: "/icon-192.png",
    vibrate: [300, 100, 300],
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) =>
    list.length ? list[0].focus() : self.clients.openWindow("/")));
});
