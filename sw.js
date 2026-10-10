// Kleine service worker zodat Vlogit als app op je beginscherm kan.
// Hij bewaart niets: je krijgt altijd de nieuwste versie van de app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
