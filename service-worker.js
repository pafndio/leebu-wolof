/* Wolof Njaay Neena — service worker
   Précharge l'application pour qu'elle s'ouvre hors ligne après une première visite.
   Stratégie : le réseau d'abord (les mises à jour arrivent seules), le cache en secours.
   Pensez à changer CACHE_NAME à chaque publication pour nettoyer l'ancien cache. */

var CACHE_NAME = "wolof-njaay-neena-v7";
var META_CACHE = "njaay-meta"; // état du rappel quotidien, partagé avec js/app.js

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
        keys.filter(function (key) { return key !== CACHE_NAME && key !== META_CACHE; })
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

/* ---------------- Rappel quotidien (Android, app installée) ----------------
   Le téléphone réveille le service worker environ une fois par jour. Le léebu choisi
   est le même que dans l'app : hashString(AAAA-M-J) % nombre de léebu (voir js/app.js). */

function hashString(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function todayKey() {
  var d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function metaUrl(name) {
  return new URL("__njaay/" + name, self.registration.scope).href;
}

function sendDailyLeebu() {
  var key = todayKey();
  return caches.open(META_CACHE).then(function (meta) {
    return Promise.all([meta.match(metaUrl("daily-on")), meta.match(metaUrl("last-notified"))]).then(function (r) {
      if (!r[0]) return; // rappel désactivé
      return (r[1] ? r[1].text() : Promise.resolve(null)).then(function (last) {
        if (last === key) return; // déjà envoyé aujourd'hui
        return fetch("./data/citations.json").catch(function () {
          return caches.match("./data/citations.json", { ignoreSearch: true });
        }).then(function (res) { return res.json(); }).then(function (citations) {
          var c = citations[hashString(key) % citations.length];
          return self.registration.showNotification("Léebu du jour", {
            body: c.citation + (c.traduction ? "\n« " + c.traduction + " »" : ""),
            icon: "./assets/icons/icon-192.png",
            badge: "./assets/icons/icon-192.png",
            tag: "leebu-du-jour",
            data: { url: "./?source=notification#accueil" }
          }).then(function () {
            return meta.put(metaUrl("last-notified"), new Response(key));
          });
        });
      });
    });
  });
}

self.addEventListener("periodicsync", function (event) {
  if (event.tag === "leebu-du-jour") event.waitUntil(sendDailyLeebu());
});

// Toucher la notification d'un léebu : revient sur l'application (ou l'ouvre)
self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || "./#accueil";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ("focus" in list[i]) return list[i].focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
