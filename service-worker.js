/* Wolof Njaay Neena — service worker
   Précharge l'application pour qu'elle s'ouvre hors ligne après une première visite.
   Stratégie : le réseau d'abord (les mises à jour arrivent seules), le cache en secours.
   Pensez à changer CACHE_NAME à chaque publication pour nettoyer l'ancien cache. */

var CACHE_NAME = "wolof-njaay-neena-v6";

var APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./js/app.js",
  "./config.js",
  "./data/citations.json",
  "./assets/kente-band.jpg",
  "./assets/fonts/poppins-latin-500-normal.woff2",
  "./assets/fonts/poppins-latin-600-normal.woff2",
  "./assets/fonts/poppins-latin-700-normal.woff2",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon-16.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // cache: "reload" contourne le cache HTTP du navigateur / de GitHub Pages
      return Promise.all(APP_SHELL.map(function (path) {
        return cache.add(new Request(path, { cache: "reload" }));
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  if (url.origin !== location.origin) return; // polices Google etc. : laissées au navigateur

  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (cached) {
        if (cached) return cached;
        if (req.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
