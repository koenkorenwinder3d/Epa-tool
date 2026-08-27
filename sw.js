/* EPA Schets — service worker.
 *
 * index.html bevat React en three.js zelf, dus er valt niets van een CDN te
 * cachen: deze worker hoeft alleen de app en de iconen te bewaren zodat de
 * browser hem zonder verbinding kan starten.
 *
 * Bij elke wijziging aan index.html moet CACHE omhoog, anders blijft een
 * geinstalleerde iPad op de oude versie hangen.
 */
const CACHE = "epa-v4";

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

function putInCache(req, res) {
  if (!res || !res.ok) return res;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Adresopzoeking (PDOK/BAG/3D BAG): altijd vers, nooit uit de cache.
  if (/pdok\.nl|kadaster\.nl|3dbag\.nl/.test(url.hostname)) return;

  // De app zelf eerst van het net proberen. Cache-first was hier fout: een
  // geïnstalleerde iPad bleef dan op de vorige versie hangen tot deze worker
  // toevallig verving. Zonder verbinding valt hij gewoon terug op de cache,
  // dus offline werkt onveranderd.
  const isApp =
    req.mode === "navigate" ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname.endsWith("/manifest.webmanifest");
  if (isApp) {
    e.respondWith(
      fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => caches.match(req).then((hit) => hit || caches.match("./index.html")))
    );
    return;
  }

  // De rest (iconen) verandert zelden: die mag uit de cache.
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => putInCache(req, res))
        .catch(() => caches.match("./index.html"));
    })
  );
});
