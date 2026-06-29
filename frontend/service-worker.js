// Service worker minimal — son seul rôle ici est de rendre l'app
// installable (condition requise par Android/Chrome pour proposer
// "Ajouter à l'écran d'accueil"). Pas de mise en cache agressive :
// l'app dépend d'une API backend en ligne, donc un mode hors-ligne
// complet n'aurait pas de sens pour l'instant.

const CACHE_NAME = 'solardim-shell-v1';
const SHELL_FILES = [
  './pages/app.html',
  './css/layout.css',
  './css/components.css',
  './css/rapport.css',
  './js/config.js',
  './js/app.js',
  './js/wizard.js',
  './js/calcul.js',
  './js/rapport.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

// Stratégie "network first" : toujours essayer le réseau d'abord
// (pour avoir les dernières données/version), et ne retomber sur
// le cache que si le réseau est indisponible (mode hors-ligne).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
