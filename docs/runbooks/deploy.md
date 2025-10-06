# Runbook: Deploy

**Scope:** Manuelle oder CI-getriggerte Deployments nach **dev / stage / prod**.

## Vorbedingungen (alle erfüllt)
- CI-Pipeline grün: Lint, Build, Tests (Coverage ≥ 80 %), OpenAPI-Lint „pass“.
- Release-Artefakt vorhanden und **gepinnt** (z. B. `release_dev.tgz` aus CI-Run).
- Ziel-Environment geschützt (Reviewer/Timer) und Secrets/Vars gesetzt.
- EU-Region konfiguriert (z. B. `REGION=eu`).

## Schritte – GitHub Actions (empfohlen)
1. Öffne **Actions → deploy → Run workflow**.
2. `env` wählen: `dev` | `stage` | `prod`.
3. Falls vorhanden: Release-Artefakt/Version auswählen oder Referenz (Tag/Run-URL) eintragen.
4. Bei `stage/prod`: Environment-**Approval** einholen.
5. Warte auf Abschluss des Jobs „deploy“.

## Schritte – Alternativ (CLI)
> Nur falls freigegeben:
1. Release-Tag setzen:  
	 `git tag -a vX.Y.Z -m "release"` und `git push --tags`
2. Mit PaaS/Infra-CLI deployen (z. B. Flyctl/Terraform) **gegen EU-Region**.
3. CLI-Output sichern (Audit).

## Verifikation nach Deploy
- **Health:** `/health` oder PaaS-Healthchecks grün.
- **Smoke-Tests:** wesentliche Routen:
	- API: `/v1/stamps/claim` (dry-run/test-mode), `/v1/rewards/redeem` (dry-run)
	- Web: Landing + Login/Flow erreichbar
- **Metriken/Logs:** 5xx-Rate unverändert, p95/p99 im Rahmen, keine Secret-Leaks im Log.

## Abbruchkriterien
- Healthcheck rot oder 5xx-Rate ↑ anhaltend.
- Smoke-Tests fehlschlagen.
- Latenz p95 deutlich außerhalb SLO.
→ **Sofort Rollback** (siehe unten) und Incident eröffnen.

## Rollback
- Siehe `rollback.md`. Vorher: Traffic drosseln/Freeze, dann auf letztes **stabiles** Artefakt zurück.

## Notizen & Audit
- Run-URL, Artefaktname/Hash, Ziel-Environment, Freigeber, Start/Ende-Zeitpunkt dokumentieren.
- Keine personenbezogenen Daten in Logs posten.

## Kontakte
- Oncall: @team-security
