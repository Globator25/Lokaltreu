# Runbook: Deploy (dev / stage / prod)

Scope: manuelle oder CI-getriggerte Deployments des Lokaltreu-Monolithen. Gilt für Fly.io (API), Cloudflare (PWA/CDN) und begleitende Worker. Alle Deployments erfolgen ausschließlich in EU-Regionen. Referenzen: `docs/runbooks/blue-green.md`, `docs/CI-Gates.md`, `docs/releases/`.

---

## Vorbedingungen (alle erfüllt)
- CI-Pipeline grün (`ci`, `security-gates`, `gdpr-compliance`), Coverage ≥ 80 %, schema_drift = 0.  
- Release-Artefakt eindeutig gepinnt (SHA/Tag + Build-URL).  
- Ziel-Environment hat freigegebene Secrets/Vars (SOPS verwaltet), EU-Region param `REGION=eu`.  
- Incident-/Status-Page ready; Oncall informiert; Backups aktuell (<24 h).  
- Falls stage/prod: Deployment-Plan + genehmigtes Change-Ticket.

---

## Schritte – GitHub Actions (empfohlen)
1. **Actions → deploy → Run workflow.**  
2. `env` wählen: `dev`, `stage` oder `prod`.  
3. Release-Artefakt/Tag auswählen (z. B. `build-<sha>`).  
4. Manuelle Inputs (Feature-Flags) setzen.  
5. Stage/Prod: Environment-Approval durch Maintainer einholen.  
6. Job „deploy“ überwachen; Output in Release-Notes/Audit verlinken.

---

## Schritte – Alternativ (CLI, nur mit Freigabe)
1. Release-Tag setzen/pushen (`git tag -a vX.Y.Z ...`).  
2. `fly deploy --strategy canary --env REGION=eu ...` für API; ggf. `npm run deploy:pwa` für CDN.  
3. Terraform/Infra-Anteile (`terraform apply`) nur nach Approval.  
4. CLI-Output/Logs sichern und im Deployment-Log ablegen.

---

## Verifikation nach Deploy
- **Health:** `/health` und Fly health checks grün.  
- **Smoke-Tests:** `/v1/stamps/claim` (test token), `/v1/rewards/redeem`, PWA Landing + Mitarbeiter-UI.  
- **Observability:** p50/p95/p99 innerhalb Zielwerte, `error_5xx_rate` stabil, `rate_token_reuse` unverändert.  
- **Logs/Audit:** keine PII, Break-Glass = nein, Deployment-Event protokolliert.  
- **Plan-Limits & Device-Proof Tests:** Stichproben (Starter→403, Device-Proof Failure→401).

---

## Abbruchkriterien
- Healthchecks rot oder `error_5xx_rate` > Basiswert +50 % für >5 Min.  
- Smoke-Tests fehlschlagen oder Device-Proof-Fails sprunghaft.  
- Latenz p95 deutlich außerhalb SLO (z. B. >4 s) oder cost_per_tenant Alert.  
→ Deployment stoppen, Rollback einleiten, Incident eröffnen (Runbook „Incident-Breach“).

---

## Rollback
- Siehe `docs/runbooks/blue-green.md` und `rollback.md`.  
- Traffic einfrieren/drosseln, `fly alloc --set-primary` auf vorherige Version.  
- Falls Schema unverträglich → Deploy vorherige Migration/Artifact.  
- Status-Page auf „Incident“, Root Cause Analyse starten.

---

## Notizen & Audit
- Dokumentiere: Workflow-URL, Artefakt, Commit, Environment, Approver, Start/Ende, Ergebnis.  
- Eintrag in `docs/releases/vX.Y.Z.md` ergänzen.  
- Prompt-Log aktualisieren, falls KI im Prozess genutzt wurde.  
- Keine personenbezogenen Daten in Logs/Slack.

---

## Kontakte
- Oncall: @team-security  
- Tech Lead / Infra-Engineer bei Eskalationen
