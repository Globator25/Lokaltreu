# Request Security Flow (dev baseline)

## 1. jti / Anti-Replay
- Jede sicherheitsrelevante Aktion trägt eine eindeutige Token-ID (`jti`).
- Diese ID wird für 60 Sekunden als "verbraucht" markiert.
- Zweitverwendung derselben `jti` führt zu HTTP 429 (Too Many Requests).
- Implementiert durch `replayStore.checkAndSetJti(jti, 60)`.

Zweck:
- Schutz gegen doppelte Einlösung (z. B. Stempel oder Rewards mehrfach abholen).
- Vorgabe aus SPEC: QR-Token mit jti + TTL=60s, Anti-Replay via Redis `SETNX`.

## 2. Fehlerformat (RFC 7807)
- Fehler werden als JSON im Problem Details Format zurückgegeben.
- Felder: `type`, `title`, `status`, `detail`.
- Beispiel bei Replay: status 429, title "Too Many Requests", type "https://lokaltreu/errors/rate-limit".
- Diese Antworten sind maschinenlesbar und auditierbar.

## 3. Health vs. Secure Action
- `/health`: liefert HTTP 200 "OK". Wird für Liveness genutzt.
- `/secure-action`: verlangt `jti`. Erster Aufruf 200 OK, zweiter Aufruf 429.
- Das zeigt, dass Sicherheitslogik bereits vor der Business-Logik greift.

## 4. DeviceProof (nächster Schritt)
- Jeder Request von einem Gerät soll einen Header "X-Device-Proof" enthalten:
  - deviceId
  - publicKey (Ed25519, Base64)
  - signature (Signatur über Requestdaten)
  - nonce (Einmalwert gegen Replay)
- Die Struktur dafür liegt in `src/security/device/types.ts`.
- Validierung kommt als Nächstes.

## 5. AuditEvent und WORM
- Sicherheitsrelevante Aktionen werden als AuditEvent beschrieben (`src/security/audit/types.ts`).
- Diese Events werden WORM gesichert (Write Once Read Many).
- Export nach Cloudflare R2 (EU-Jurisdiction) mit 180 Tagen Aufbewahrungspflicht laut SPEC.

## 6. SLO / Abuse Monitoring
- 429-Raten aus `/secure-action` und später aus produktiven Routen fließen in Observability (Loki, Tempo, Grafana).
- Relevante NFRs laut SPEC / ARCH:
  - p95 Latenz ≤ 3000 ms
  - Verfügbarkeit Kernrouten ≥ 99,90 %
  - Resilienz: RPO 15 min, RTO 60 min
  - Rate-Limits pro Tenant, IP, Card-ID, Device
