# Step 35 – PWA Service Worker Spot-Checks

## Build/Quality Gates
- npm run lint (all workspaces): OK
- npm test --workspaces: OK
- npm run build: OK

## Static assets (PowerShell)
- GET /pwa/sw.js -> 200
- GET /pwa/offline.html -> 200
- GET /pwa/manifest.webmanifest -> 200
- GET /icons/pwa-192.png -> 200
- GET /icons/pwa-512.png -> 200
- GET /icons/pwa-192-maskable.png -> 200
- GET /icons/pwa-512-maskable.png -> 200

## Manual browser checks (no DevTools)
- Open http://localhost:3000/pwa/scan -> page loads
- Disable Wi-Fi (offline) -> Reload -> app does not crash; offline fallback behaves as expected
- Re-enable Wi-Fi -> Reload -> back online
