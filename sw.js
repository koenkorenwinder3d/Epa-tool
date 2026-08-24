/* EPA Schets — service worker.
 *
 * index.html bevat React en three.js zelf, dus er valt niets van een CDN te
 * cachen: deze worker hoeft alleen de app en de iconen te bewaren zodat de
 * browser hem zonder verbinding kan starten.
 *
 * Bij elke wijziging aan index.html moet CACHE omhoog, anders blijft een
 * geinstalleerde iPad op de oude versie hangen.
 */
const CACHE = "epa-v2";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Een enkel onbereikbaar bestand mag de installatie niet laten mislukken.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => {})
        )
      );
      self.skipWaiting();
    })
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // Adresopzoeking (PDOK/BAG/3D BAG): altijd vers, nooit uit de cache.
  if (/pdok\.nl|kadaster\.nl|3dbag\.nl/.test(new URL(req.url).hostname)) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
