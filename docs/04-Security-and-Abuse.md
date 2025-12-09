# Security & Abuse – Lokaltreu

Dieses Dokument beschreibt Sicherheitsarchitektur, Abuse-Prevention und zugehörige Kontrollen nach [SPEC §7–§8, §14–§16], [ARCH], [ROADMAP 2.3.1], [AGENTS §2, §6].

---

## 1. Authentifizierung & Device-Proof

- **Admin-JWT:** Access-Token ≤ 15 Min, Refresh-Token ≤ 30 Tage, Signatur via asymmetric JWKS (`/.well-known/jwks.json`). Rotation hat 24 h Vorlauf, Runbooks für JWKS-Rotation/Rollback vorhanden (docs/runbooks/\*). Sessions sind mandantenisoliert; Single-Admin-Design verhindert Rollenkomplexität.  
- **Geräte-Schlüssel (Ed25519):** Mitarbeitergeräte registrieren sich über einen einmaligen Link (TTL 15 Min) und generieren lokal ein Ed25519-Paar. Public Key wird im Backend gespeichert; Private Key verbleibt ausschließlich auf dem Gerät.  
- **X-Device-Proof:** Kritische Calls (`/stamps/tokens`, `/rewards/redeem`, `/devices/*`) enthalten signierten Header: `X-Device-Proof: sign(method|path|ts|jti, devicePrivateKey)`. Zeitfenster ±30 Sekunden; Requests außerhalb werfen 401 DEVICE_PROOF_INVALID.  
- **Security Alerts:** Jede Bindung/Sperre eines Geräts löst Mailbenachrichtigung + Audit-Event aus, damit der Inhaber Missbrauch sieht.  
_Quelle: [SPEC §7.1], [SPEC §13], [ROADMAP Schritte 29, 32], [AGENTS §1]_

---

## 2. Token- & QR-Handling

- **StampToken / RewardToken:** UUIDv7 `jti`, TTL 60 Sekunden (+30 s Skew), einmalig verwendbar. Token werden in Redis gehalten (Key = `jti`, Value = tenantId/deviceId) und nach Ablauf purged.  
- **QR-Parameter:** ECC-Level „Q“, Auflösung ≥ 300×300 px, Kontrast ≥ 4.5:1, Gültigkeit auf Kampagne & Tenant begrenzt.  
- **Referral Codes:** Mandantenbezogen, Referrer/Referee-IDs pseudonymisiert, Velocity-Limits siehe Abschnitt 4.  
_Quelle: [SPEC §7.2], [SPEC §15], [ARCH]_

---

## 3. Anti-Replay, Idempotenz & Audit

- **Redis `SETNX` + ACID:** Jeder QR-/Redeem-Token wird mit `SETNX(jti,"lock",ttl)` reserviert. Nur der erste erfolgreiche `SETNX` darf den Geschäftsprozess ausführen; alle anderen liefern 409 TOKEN_REUSE.  
- **Idempotency-Key:** Header `Idempotency-Key` mit Scope `{tenantId, route, bodyHash}` und TTL 24 h schützt vor Client-Retries bei Netzfehlern. Wiederholungen geben exakt denselben Response zurück (Problem+JSON inkl. identischer `correlation_id`).  
- **WORM-Audit:** Ereignisse `device.register`, `stamp.token.issued`, `stamp.claimed`, `reward.redeemed`, `referral.*` werden append-only in Postgres gespeichert, 180 Tage aufbewahrt und regelmäßig signiert nach R2 exportiert.  
- **Observability:** `rate_token_invalid` und `rate_token_reuse` werden als KPIs überwacht; Alerts bei Spike >5/Minute/Tenant.  
_Quelle: [SPEC §7.3–§7.5], [SPEC §19], [AGENTS §6], [ROADMAP Schritte 37–43]_

---

## 4. Rate-Limits & Abuse-Gates

- **Tenant:** 600 Requests/Minute für Hot-Routen.  
- **IP (anonym):** 120 Requests/Minute – schützt PWA-Endpunkte.  
- **Card:** `/stamps/claim` max. 30 Requests/Minute pro Card-ID.  
- **Device:** `/rewards/redeem` max. 10 Requests/Minute je Mitarbeitergerät.  
- **Referral Velocity:** max. 5 qualifizierte Referrals je referrerCard/Monat; Self-Referral blockiert (422).  
- **Plan-Gates:** Referral-Funktionen nur in Plus/Premium aktiv. Starter-Anfragen produzieren 403 PLAN_NOT_ALLOWED; Downgrade deaktiviert Referrals automatisch.  
- Limits werden in Redis (Counter per Scope + TTL) und ggf. API-Gateway/Edge enforced; Verstöße triggern Alerts sowie Audit-Einträge.  
_Quelle: [SPEC §7.3], [SPEC §16], [ROADMAP Schritte 25–26, 42], [AGENTS §6]_

---

## 5. Security Operations & Runbooks

- **Break-Glass:** Nur bei kritischen Incidents erlaubt; Ablauf siehe AGENTS §5 und Roadmap Schritt 42 (Audit + Ticket-Pflicht, unverzügliche Gate-Wiederherstellung).  
- **Runbooks:** JWKS-Rotation/Rollback, Restore, Replay-Suspected, Incident-Breach (72 h Meldung). Alle verweisen auf Anti-Replay- und Device-Proof-Kontrollen.  
- **Incident-Detection:** Observability-Dashboards (p50/p95/p99, Fehlscan-Spikes, cost_per_tenant) + Status-Page (Schritt 47).  
- **Compliance-Kopplung:** Security-Kontrollen sind mit Art. 6 Abs. 1 lit. f begründet; Logs enthalten keine PII, nur pseudonyme IDs. DSR/Tombstone-Flows stellen sicher, dass Restore-Prozesse keine gelöschten Subjekte reaktivieren.  
_Quelle: [SPEC §8], [ROADMAP Schritte 8–9, 42–48], [AGENTS §5, §9]_
