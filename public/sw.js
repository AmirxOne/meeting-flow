/* مهرسا PWA shell — cache fonts/icons/offline; never intercept /api or /_next */
const CACHE = "mehrsa-shell-v2";
const SHELL = [
  "/offline.html",
  "/fonts/Alibaba-Regular.woff2",
  "/fonts/Alibaba-Bold.woff2",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/_next/")) return;

  const isShellAsset =
    SHELL.includes(url.pathname) ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/");

  if (isShellAsset) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req)),
    );
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/offline.html")),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "مهرسا", body: "", url: "/meetings" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      data.body = event.data ? event.data.text() : "";
    } catch {
      /* empty payload */
    }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "مهرسا", {
      body: data.body || "",
      dir: "rtl",
      lang: "fa",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/meetings" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/meetings";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const abs = new URL(target, self.location.origin).href;
      const existing = windows.find((c) => c.url.startsWith(self.location.origin));
      if (existing) {
        existing.focus();
        if ("navigate" in existing) return existing.navigate(abs);
        return undefined;
      }
      return self.clients.openWindow(abs);
    }),
  );
});
