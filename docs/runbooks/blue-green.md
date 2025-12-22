# Runbook: Blue-Green Rollout (Fly.io EU)

**Ziel:** Risikominimiertes Release des API-Monolithen (apps/api) in Fly.io `eu-central`, inkl. kontrolliertem Traffic-Switch, Rollback-Pfad und Observability-Kontrolle.

**Voraussetzungen**
- CI-Gates grün (`ci`, `security-gates`, `gdpr-compliance`).  
- Datenbank-Migrationen im Expand-Contract-Status (Schema-Kompatibilität geprüft).  
- Feature-Flags aktiviert/deaktiviert laut Release-Plan.  
- On-Call-Team informiert; Status-Page bereit für Update.

---

## Ablauf

1. **Vorbereitung (Blue läuft produktiv)**
   - Green-Deployment (`fly deploy --strategy canary --app lokaltreu-api-green`) starten.  
   - Konfiguration identisch zu Blue, lediglich Version/Commit neu.  
   - Auto-Scaling identisch, Secrets mit SOPS/`fly secrets import` aktualisiert.

2. **Smoke-Tests & Health-Checks**
   - `fly status --app lokaltreu-api-green` prüfen.  
   - Synthetic Tests (Prism/Contract-Suite) gegen Green-Endpunkt ausführen.  
   - Observability: p50/p95/p99, Fehler-Rate, rate_token_invalid überwachen.  
   - Wenn Fehler, Deployment stoppen und Ursachen analysieren.

3. **Traffic-Switch (Canary → Full)**
   - Schrittweise Traffic-Anteile erhöhen (`fly alloc --set-primary`).  
   - Status-Page auf „Maintenance" stellen, falls nötig.  
   - Dashboards beobachten (latency, 5xx, cost_per_tenant).  
   - Bei stabilen Metriken Switch komplettieren (Green → Primary).

4. **Post-Switch Validation**
   - Runbooks (JWKS-Rotation, Incident-Breach) verlinkte Checkliste abhaken.  
   - Logs/Audit: Break-Glass = nein, Release notieren.  
   - Status-Page aktualisieren („Deployment erfolgreich").

---

## Rollback

- `fly alloc --set-primary <blue-id>` → Switch zurück auf Blue.  
- Falls Schema-Inkompatibilität: Deploy vorherige Version (`fly deploy --image <blue-image>`).  
- Incident dokumentieren, Status-Page auf „Incident" setzen, Ursachenanalyse durchführen.

---

## Nacharbeiten

- Green als neue Blue deklarieren (Dokumentation aktualisieren).  
- Observability-Snapshot exportieren (Grafana JSON + Logs).  
- Release Notes (docs/releases/vX.Y.Z.md) aktualisieren.  
- Lessons Learned ins Post-Go-Live-Dokument aufnehmen.
