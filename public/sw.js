
const CACHE_NAME = "manns-intelligence-v1";
const OFFLINE_URL = "/offline.html";

// Install service worker dan simpan offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(OFFLINE_URL);
    })
  );

  self.skipWaiting();
});

// Bersihkan cache versi lama
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// Network first untuk navigasi halaman
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Hanya tangani navigasi halaman
  if (request.mode !== "navigate") return;

  // Jangan intercept request lintas origin
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Simpan halaman sukses agar bisa dipakai sebagai fallback
        if (response.ok) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy);
          });
        }

        return response;
      })
      .catch(async () => {
        // Jika offline, coba halaman yang pernah dibuka
        const cachedPage = await caches.match(request);

        if (cachedPage) return cachedPage;

        // Jika belum pernah dibuka, tampilkan offline page
        return (
          (await caches.match(OFFLINE_URL)) ||
          new Response("Kamu sedang offline.", {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
            },
          })
        );
      })
  );
});