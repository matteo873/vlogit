// Service worker van Vlogit: maakt installeren mogelijk en toont meldingen.
// Hij bewaart niets: je krijgt altijd de nieuwste versie van de app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "Vlogit", {
    body: d.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png",
    tag: d.tag,
    data: { url: d.url || "/" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) { if ("focus" in c) { c.navigate && c.navigate(url).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(url);
  })());
});
