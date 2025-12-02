# Kernprozesse: Lokaltreu

Zusammenfassung der end-to-end Abläufe laut Technischer Spezifikation. Jeder Prozess zeigt Akteure, Trigger, Ablauf (3–6 Schritte) und relevante APIs/Datenobjekte.

## Onboarding & Kampagne

- **Akteure:** Admin, Portal (Next.js), API, Postgres (tenant/campaign)
- **Trigger:** Admin schließt Lokaltreu-Vertrag ab und legt die erste Kampagne an.
- **Ablauf:**  
  1. Admin erstellt Konto via `POST /tenants` und bestätigt Mail-Link.  
  2. Portal fordert Kampagnen-Blueprint (`GET /campaigns/template`) und zeigt Defaults.  
  3. Admin definiert Regeln (Targets, Rewards, Limits) und speichert via `POST /campaigns`.  
  4. API provisioniert Mandant (Postgres schemas, Redis namespaces) und erzeugt Stempelkarte (`card_layout`).  
  5. System gibt QR-Mastercode (`GET /campaigns/:id/qr`) zurück und setzt Audit-WORM-Plan an.  
- **Relevante APIs:** `POST /tenants`, `GET/POST /campaigns`, `GET /campaigns/:id/qr`, `GET /audit/plans/:tenant`.

## Geräteautorisierung

- **Akteure:** Admin, Portal, API, Device, Redis (device tokens), Mail
- **Trigger:** Admin benötigt neues Mitarbeitergerät mit beschränkten Aktionen.
- **Ablauf:**  
  1. Admin fordert Registrierungscode (`POST /devices/registration-links`, TTL 15 min).  
  2. Gerät scannt Link (`GET /devices/register?token`) und prüft Device-Proof (Ed25519).  
  3. Gerät sendet Bestätigung (`POST /devices/register/confirm`) mit Proof + device_id.  
  4. API legt Gerät in Postgres/Redis an, setzt Rate-Limits, informiert Admin per Mail (`POST /alerts/device`).  
- **Relevante APIs:** `POST /devices/registration-links`, `GET /devices/register`, `POST /devices/register/confirm`, `POST /alerts/device`.

## Stempelvergabe

- **Akteure:** Mitarbeitergerät, API, Redis (idempotency/anti-replay), Postgres (stamp ledger), Audit Log
- **Trigger:** Kund:in scannt QR-Code und möchte einen Stempel erhalten.
- **Ablauf:**  
  1. Gerät scannt QR (`POST /stamps` mit `idempotency-key`, device_id, card_id).  
  2. API prüft Device-Proof, Rate-Limits und Idempotency (Redis).  
  3. Bei Erfolg wird Stempel im Ledger (`stamp_entry`) persistiert, Karte aktualisiert (`PATCH /cards/:id`).  
  4. Audit-Event (`POST /audit/logs`) und optional Push an Portal (`POST /events/stamp`).  
- **Relevante APIs:** `POST /stamps`, `PATCH /cards/:id`, `POST /audit/logs`, `POST /events/stamp`.

## Prämieneinlösung

- **Akteure:** Mitarbeitergerät, API, Postgres (reward ledger), Mail/SMS optional
- **Trigger:** Karte erfüllt Reward-Kriterien, Kund:in löst Prämie ein.
- **Ablauf:**  
  1. Gerät sendet Einlösungsanforderung (`POST /rewards/redeem` mit card_snapshot).  
  2. API validiert Anspruch (Rule Engine) und sperrt Karte (`PATCH /cards/:id/status=locked`).  
  3. Reward-Ledger schreibt Einlösung, löst Optional-Meldung an Admin/kundenseitige Quittung aus.  
  4. Audit-Event + Device-Proof-Check werden protokolliert.  
- **Relevante APIs:** `POST /rewards/redeem`, `PATCH /cards/:id`, `POST /notifications/reward`, `POST /audit/logs`.

## Referral

- **Akteure:** Admin (Werber), Referral-Empfänger, Portal, API, Mail
- **Trigger:** Bestehender Admin lädt Kolleg:in ein und verfolgt Conversion.
- **Ablauf:**  
  1. Admin startet Referral (`POST /referrals` mit target_email, incentive).  
  2. System erzeugt signierten Link (`GET /referrals/:id/link`) und versendet Mail.  
  3. Empfänger eröffnet Konto über Referral-Link (`POST /tenants` mit referral_token).  
  4. API markiert Referral als gewonnen (`PATCH /referrals/:id/status=won`) und bucht Incentive (z. B. zusätzliche Prämien).  
- **Relevante APIs:** `POST /referrals`, `GET /referrals/:id/link`, `POST /tenants`, `PATCH /referrals/:id`.

## DSR & Betrieb

- **Akteure:** Admin, Compliance-Tooling, API, Audit-Officer, Storage (R2, WORM Logs)
- **Trigger:** Daten­schutz­anfrage (DSR), Audit-Pflichten oder Routinebetrieb (Retention).
- **Ablauf:**  
  1. Admin meldet DSR oder Audit-Export (`POST /compliance/dsr-requests` oder `/audit/exports`).  
  2. API validiert Identität ohne Zusatzdaten (Art. 11) und plant Job in WORM-Queue.  
  3. Backend sammelt relevante Datensätze (Postgres, R2) und erstellt signiertes Archiv (`PUT /exports/:id/file`).  
  4. Audit-Officer prüft und bestätigt Bereitstellung (`PATCH /audit/exports/:id/status=delivered`).  
  5. Retention-Jobs (`POST /compliance/retention/run`) verifizieren 180-Tage-Löschpfade und Anti-Replay-Artefakte.  
- **Relevante APIs:** `POST /compliance/dsr-requests`, `POST /audit/exports`, `PUT /exports/:id/file`, `PATCH /audit/exports/:id`, `POST /compliance/retention/run`.
