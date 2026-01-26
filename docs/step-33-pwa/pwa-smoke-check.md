# Schritt 35 – PWA Smoke-Checks (Service Worker)

## Preconditions

- Next dev (PWA): `npm -w apps/web run dev`
- Optional: Prism Mock (nur wenn API-Calls getestet werden sollen): `npm run mock:api`
- Browser: Chrome (DevTools)

## Hard Checks (HTTP)

> Beispiele fuer Windows PowerShell `Invoke-WebRequest` oder curl. Keine PII.

- `GET http://localhost:3000/pwa/manifest.webmanifest`
  - Erwartung: `200 OK`, Content-Type `application/manifest+json` oder `application/json`
- `GET http://localhost:3000/pwa/sw.js`
  - Erwartung: `200 OK`, Content-Type `application/javascript`
- `GET http://localhost:3000/pwa/offline.html`
  - Erwartung: `200 OK`, HTML mit Offline-Text
- `GET http://localhost:3000/icons/pwa-192.png`
  - Erwartung: `200 OK`, Content-Type `image/png`
- `GET http://localhost:3000/icons/pwa-512.png`
  - Erwartung: `200 OK`, Content-Type `image/png`

## DevTools Checks (Chrome)

- Application -> Manifest:
  - `name/short_name=Lokaltreu`
  - `start_url=/pwa/scan`
  - `scope=/pwa/`
  - `display=standalone`
  - Icons (192/512 + maskable) geladen
- Application -> Service Workers:
  - Script URL `/pwa/sw.js`
  - Scope `/pwa/`
  - Clients zeigen `/pwa/*`
- Application -> Cache Storage:
  - Caches mit `pwa-` Prefix vorhanden
- Admin Isolation:
  - Tab `/admin/dashboard` -> `navigator.serviceWorker.controller` ist `null`
  - Keine `/admin/*` Clients im PWA-SW

## Offline Test

- DevTools -> Network -> Offline setzen
- `/pwa/scan` neu laden
  - Erwartung: Offline-Fallback (kein White-Screen)
- Aktion mit POST (z. B. Claim/DSR Create) ausloesen
  - Erwartung: sauberer Fehler, kein Erfolg aus Cache

## Update Flow Test

- `apps/web/public/pwa/sw.js` Version aendern (z. B. `const VERSION = "v2"`)
- `/pwa/scan` reloaden
- DevTools -> Application -> Service Workers -> "Update" klicken
- Erwartung:
  - Banner "Neue Version verfuegbar" erscheint
  - Klick "Aktualisieren" -> Seite reloadet, neuer SW aktiv

## Evidence Pack (Screenshots)

- Application -> Manifest (zeigt Start URL, Scope, Icons)
- Application -> Service Workers (Script URL + Clients)
- Application -> Cache Storage (pwa-* Caches)
- Admin Tab: `navigator.serviceWorker.controller === null`
- Offline-Reload /pwa/scan (Offline-Fallback sichtbar)
- Update-Banner + nach Reload aktiver neuer SW
