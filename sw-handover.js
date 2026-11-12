// Loaded into the generated service worker (workbox.importScripts in vite.config.ts).
//
// Builds up to 5.9.0 updated themselves: their worker skipped waiting, and their pages had no
// "Update ready" line. Newer workers wait for that line to say go, so an old page would never
// let one in, and the phone stayed on the old build until every tab closed.
//
// This takes over once from such a worker and reloads its pages into the new build. A worker
// that installs alongside one of these newer workers leaves a marker cache behind, so after the
// first handover every update waits for the reload line again. The marker is named for the
// scope, because staging and the public app share one origin and one cache storage.
const HANDOVER_MARKER = `munch-waits-for-reload:${self.registration.scope}`;
let handover = false;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.has(HANDOVER_MARKER).then((marked) => {
      // A first install has nothing to take over from, so it activates as usual.
      if (marked || !self.registration.active) return;
      handover = true;
      return self.skipWaiting();
    }),
  );
});

self.addEventListener('activate', (event) => {
  const activated = (async () => {
    await caches.open(HANDOVER_MARKER);
    if (handover) await self.clients.claim();
  })();
  event.waitUntil(activated);
  if (!handover) return;
  // The old page's files are about to leave the precache, so it reloads rather than asking for
  // a chunk that's gone. This waits for activation to finish, because the browser holds a
  // page's requests until then and waiting inside it would never end.
  activated
    .then(() => self.clients.matchAll({ type: 'window' }))
    .then((pages) => Promise.all(pages.map((page) => page.navigate(page.url).catch(() => {}))))
    .catch(() => {});
});
