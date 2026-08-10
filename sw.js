/* Makes the deployed app usable with no network.

   The shell is network-first: an online visit always gets the current build, so this can
   never strand anyone on a stale version — the cache is only a fallback for when the
   network is gone. Attachments are cache-first, which is safe because their filenames are
   hashes of their contents and therefore immutable.

   The cache name must match OFFLINE_CACHE in app/index.html: the page writes attachments
   into this same cache when you tap "Save all for offline". */
const CACHE = "eurotrip-offline-v1";
const ASSET = /\/a\/[0-9a-f]+\.bin$/;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.add("./"))
    .catch(() => {})
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;

  if(ASSET.test(url.pathname)){
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(req);
      if(hit) return hit;
      const res = await fetch(req);
      if(res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  if(req.mode === "navigate"){
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if(res.ok) (await caches.open(CACHE)).put("./", res.clone());
        return res;
      } catch(err) {
        const hit = await caches.match("./");
        if(hit) return hit;
        throw err;
      }
    })());
  }
});
