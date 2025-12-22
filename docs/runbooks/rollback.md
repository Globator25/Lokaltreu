# Runbook: Rollback

**Use case:** Schneller Rollback nach fehlerhaftem Deploy (dev/stage/prod). Referenzen: `docs/runbooks/deploy.md`, `docs/runbooks/blue-green.md`, `docs/runbooks/incident.md`.

---

## Trigger (eine Bedingung reicht)
- P1/P2-Incident, Kernrouten fehlschlagen, 5xx-Rate ↑, p95/p99 außerhalb SLO.  
- Healthchecks rot oder Deploy-Canary fällt durch.  
- Kritische Regression nach Release oder Security Finding.

---

## Vorbedingungen
- Letztes stabiles Release/Artefakt bekannt und gepinnt (Tag/SHA/Run-ID).  
- Migrationsstatus geklärt (irreversible Migrationen dokumentiert).  
- Oncall/Stakeholder informiert; Incident-/Change-Ticket offen.  
- Secrets/Feature-Flags griffbereit (für Drosselung).

---

## Schritte – Actions (empfohlen)
1. **Stabile Version bestimmen:** Tag/Run-ID notieren (`vX.Y.Z`, Build-URL).  
2. **Traffic/Jobs dämpfen:** Feature-Flags off, Worker/Jogs pausieren, optional Read-only Mode.  
3. **Rollback ausführen:**  
   - GitHub Action `deploy` starten, Environment auswählen (dev/stage/prod).  
   - Stabiles Artefakt/Tag auswählen und pinnen.  
   - Stage/Prod: Environment-Approval einholen.  
4. **Smoke-Tests:** `/health`, `/v1/stamps/claim` (dry-run), `/v1/rewards/redeem`, PWA-Kernflow.  
5. **Überwachen (≥30 Min):** 5xx, p95/p99, rate_token_reuse, Device-Proof-Fails, cost_per_tenant stabil.  
6. **Kommunikation/Audit:** Decision-Log aktualisieren (Zeitpunkt, Artefakt, Grund, Ergebnis). Stakeholder informieren, Statuspage aktualisieren.

---

## DB-Migrationen
- **Reversible Migrationen:** Migration-Rollback ausführen.  
- **Irreversible/datenverändernde Migrationen:** Code-Rollback nur mit DB-Restore (Runbook `restore-db.md`).  
- Expand-Contract beachten; Schema-Diffs dokumentieren.

---

## Abbruch/Eskalation
- Smoke-Tests weiterhin rot oder Metriken bleiben schlecht → Incident eskalieren, `restore-db.md` prüfen.  
- Wenn Rollback fehlschlägt, sofort Runbook „Incident Response“ aktivieren.

---

## Nacharbeiten
- Root-Cause-Analyse (Postmortem).  
- Fix/roll forward vorbereiten, testen und deployen (Blue-Green).  
- Monitoring/Tests/Runbooks aktualisieren; Lessons Learned dokumentieren.
