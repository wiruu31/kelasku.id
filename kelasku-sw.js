// Service worker bersama Kelasku.id dan Admin Kelasku.id (satu origin, satu cakupan). Naikkan VERSION setiap rilis supaya cache lama dibuang.
const VERSION = "kelasku-v1.0.0";
const SHELL = VERSION + "-shell";
const RUNTIME = VERSION + "-runtime";

// Daftar berkas kedua aplikasi. node tests/check-precache.mjs --write mengisinya; tanpa flag memeriksa.
const PRECACHE = [
  "./",
  "css/base.css",
  "css/components.css",
  "css/konsol/base.css",
  "css/konsol/components.css",
  "css/konsol/tokens.css",
  "css/tokens.css",
  "favicon.svg",
  "icons/favicon-konsol.svg",
  "icons/ikon-kelasku-192.png",
  "icons/ikon-kelasku-512.png",
  "icons/ikon-kelasku-apple-180.png",
  "icons/ikon-kelasku-maskable-512.png",
  "icons/ikon-konsol-192.png",
  "icons/ikon-konsol-512.png",
  "icons/ikon-konsol-apple-180.png",
  "icons/ikon-konsol-maskable-512.png",
  "js/core/clipboard.js",
  "js/core/config.js",
  "js/core/dom.js",
  "js/core/errors.js",
  "js/core/format.js",
  "js/core/router.js",
  "js/core/skeleton.js",
  "js/core/state.js",
  "js/data/auth-repository.js",
  "js/data/class-repository.js",
  "js/data/content-repository.js",
  "js/data/features-repository.js",
  "js/data/member-repository.js",
  "js/data/push-repository.js",
  "js/data/role-repository.js",
  "js/data/supabase-client.js",
  "js/konsol/components/icons.js",
  "js/konsol/components/modal.js",
  "js/konsol/components/panels.js",
  "js/konsol/components/shell.js",
  "js/konsol/components/skeleton.js",
  "js/konsol/components/table.js",
  "js/konsol/components/typed-confirm.js",
  "js/konsol/data/client.js",
  "js/konsol/data/console-repository.js",
  "js/konsol/main.js",
  "js/konsol/services/auth-service.js",
  "js/konsol/services/console-service.js",
  "js/konsol/services/nav.js",
  "js/konsol/views/add-class-view.js",
  "js/konsol/views/broadcast-view.js",
  "js/konsol/views/dashboard-view.js",
  "js/konsol/views/log-view.js",
  "js/konsol/views/login-view.js",
  "js/konsol/views/ringkasan-view.js",
  "js/konsol/views/role-view.js",
  "js/konsol/views/schools-view.js",
  "js/konsol/views/settings-view.js",
  "js/main.js",
  "js/presentation/components/auth-page.js",
  "js/presentation/components/avatar.js",
  "js/presentation/components/code-panel.js",
  "js/presentation/components/confirm.js",
  "js/presentation/components/crud-page.js",
  "js/presentation/components/entity-form.js",
  "js/presentation/components/form.js",
  "js/presentation/components/install-card.js",
  "js/presentation/components/notif-settings.js",
  "js/presentation/components/panel-tabs.js",
  "js/presentation/components/role-parts.js",
  "js/presentation/components/secret-box.js",
  "js/presentation/components/shell.js",
  "js/presentation/components/tour.js",
  "js/presentation/views/announcements-view.js",
  "js/presentation/views/approvals-view.js",
  "js/presentation/views/class-settings-view.js",
  "js/presentation/views/kas-view.js",
  "js/presentation/views/log-view.js",
  "js/presentation/views/login-view.js",
  "js/presentation/views/mading-view.js",
  "js/presentation/views/members-view.js",
  "js/presentation/views/menu-view.js",
  "js/presentation/views/organigram-view.js",
  "js/presentation/views/panel-view.js",
  "js/presentation/views/pending-module.js",
  "js/presentation/views/piket-view.js",
  "js/presentation/views/profile-view.js",
  "js/presentation/views/register-view.js",
  "js/presentation/views/role-edit-view.js",
  "js/presentation/views/roles-view.js",
  "js/presentation/views/schedule-view.js",
  "js/presentation/views/system-news-view.js",
  "js/presentation/views/tasks-view.js",
  "js/presentation/views/voting-view.js",
  "js/presentation/views/waiting-view.js",
  "js/services/access-service.js",
  "js/services/admin-service.js",
  "js/services/auth-service.js",
  "js/services/avatar-service.js",
  "js/services/content-service.js",
  "js/services/install-service.js",
  "js/services/kas-service.js",
  "js/services/permissions.js",
  "js/services/piket-service.js",
  "js/services/push-service.js",
  "js/services/role-service.js",
  "js/services/tour-service.js",
  "js/services/voting-service.js",
  "kelasku.html",
  "kelasku.webmanifest",
  "konsol.html",
  "konsol.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Data pribadi tidak boleh tersimpan di cache: semua panggilan Supabase langsung ke jaringan.
const isApi = (url) => /\.supabase\.(co|in)$/.test(url.hostname);

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === "opaque")) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached ?? (await fresh) ?? Response.error();
}

// Notifikasi push: isi dikirim server sebagai JSON {title, body, url, category, id}.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Kelasku.id";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "icons/ikon-kelasku-192.png",
      badge: "icons/ikon-kelasku-192.png",
      tag: data.category ? `${data.category}-${data.id ?? ""}` : undefined,
      data: { url: data.url || "#/mading" },
    }),
  );
});

// Ketuk notifikasi: fokuskan jendela aplikasi yang terbuka, atau buka yang baru, lalu pindah ke halaman tujuan.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const hash = String(event.notification.data?.url || "#/mading");
  const target = new URL("kelasku.html" + (hash.startsWith("#") ? hash : "#/mading"), self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const open = list.find((c) => new URL(c.url).pathname.endsWith("kelasku.html"));
      if (open) return open.navigate(target).then((c) => (c ?? open).focus());
      return self.clients.openWindow(target);
    }),
  );
});

// Langganan yang diganti browser dipasang ulang oleh aplikasi saat dibuka berikutnya.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(self.clients.matchAll({ includeUncontrolled: true }).then((list) => list.forEach((c) => c.postMessage({ type: "push-resubscribe" }))));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (isApi(url)) return;

  // Pindah halaman: selalu sajikan kerangka aplikasi, router yang memilih halaman.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(() => caches.match(url.pathname.endsWith("konsol.html") ? "./konsol.html" : "./kelasku.html", { ignoreSearch: true })),
    );
    return;
  }
  const sameOrigin = url.origin === self.location.origin;
  event.respondWith(staleWhileRevalidate(request, sameOrigin ? SHELL : RUNTIME));
});
