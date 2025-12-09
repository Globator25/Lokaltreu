# Kernprozesse: Lokaltreu

Dieses Dokument bildet die vier kritischsten Geschäftsprozesse von Lokaltreu ab. Sie referenzieren die verbindlichen Abläufe aus der Spezifikation ([SPEC §5], [SPEC §15–§16]) sowie die Roadmap-DoDs (Phase 2/3). Alle Sequenzen gehen vom Single-Admin-Modell aus und sind PWA-first gedacht.

---

## 1. Geräte-Onboarding (US-2/US-3)

Kritisch, weil jedes autorisierte Gerät Stempel und Prämien verarbeiten darf. Der Prozess erzwingt TTL=15 Min, Einmaligkeit und Security-Alert.

```mermaid
sequenceDiagram
participant Admin
participant Portal
participant API
participant Mail
participant Device

Admin->>Portal: Neues Mitarbeiter-Gerät starten
Portal->>API: POST /devices/registration-links (TTL 15m, single-use)
API-->>Portal: 201 {linkUrl, token, qrImageUrl}

Device->>API: GET /devices/register?token
API-->>Device: Bestätigungsseite mit Tenant-Namen

Device->>API: POST /devices/register/confirm (Device-Proof bootstrap)
API->>Mail: Sicherheits-Alert an Admin
API-->>Portal: device.register Audit-Eintrag, Link invalidiert
```

**Kontrollen**
- Token-Reuse → 409 TOKEN_REUSE, TTL-Expired → 400 TOKEN_EXPIRED.
- Audit: device.register (WORM, 180 Tage), Alert per Mailjet/Brevo.
- Admin kann Gerät anschließend sperren/löschen (UI-Schritt 29 Roadmap).

---

## 2. Stempelvergabe (Ablauf A – /stamps/tokens + /stamps/claim)

Ein Mitarbeitergerät erzeugt einen einmaligen QR-Token; Endkunde scannt per PWA. Anti-Replay via Redis SETNX(jti) und TTL=60 s.

```mermaid
sequenceDiagram
participant StaffUI
participant API
participant PWA

StaffUI->>API: POST /stamps/tokens (X-Device-Proof)
API-->>StaffUI: 201 {qrToken, jti, expiresAt}

PWA->>API: POST /stamps/claim {qrToken, ref?}
API->>API: SETNX(jti) + ACID AddStamp + Audit stamp.claimed
API-->>PWA: 200 {cardState, offer?}
```

**Kontrollen**
- Rate-Limits: tenant 600 rpm, card 30 rpm.
- Referral-Branch nur bei Plan ≥ Plus aktiv (Starter → 403 PLAN_NOT_ALLOWED).
- Response enthält optionale Angebots-Snippets aus Admin-Dashboard.

---

## 3. Prämieneinlösung (Ablauf B – /rewards/redeem)

Endkunde zeigt Redeem-QR aus der PWA, Mitarbeiter scannt und sendet Redeem-Request.

```mermaid
sequenceDiagram
participant PWA
participant StaffUI
participant API

PWA->>StaffUI: Zeigt Redeem-QR (once)
StaffUI->>API: POST /rewards/redeem {redeemToken} + X-Device-Proof
API->>API: SETNX(redeem jti) + ValidateCard + Audit reward.redeemed
API-->>StaffUI: 200 {cardState}
StaffUI-->>PWA: Erfolgsmeldung / Karte aktualisiert
```

**Kontrollen**
- Redeem-Token TTL, Einmaligkeit und Mandantenbindung.
- Rate-Limit 10 rpm je Gerät; Idempotency-Key Header erforderlich.
- Audit protokolliert actorType=device, target=cardId.

---

## 4. Referral „Kunden-werben-Kunden“ (US-13/US-14)

Referral-Funktion nur in Plus/Premium-Plänen. Bonus-Stempel wird erst bei validiertem ersten Stempel des geworbenen Kunden vergeben.

```mermaid
sequenceDiagram
participant ReferrerPWA
participant FriendPWA
participant API

ReferrerPWA->>API: GET /referrals/link (Plan >= Plus?)
API-->>ReferrerPWA: 200 {refCodeUrl}

FriendPWA->>API: POST /stamps/claim {qrToken, ref=code}
API->>API: firstStamp? yes -> qualifyReferral + creditBonusStamp
API-->>FriendPWA: 200 {cardState}
API-->>ReferrerPWA: Bonus-Stempel im nächsten Sync sichtbar
```

**Kontrollen**
- Starter-Plan → 403 PLAN_NOT_ALLOWED (Backend + UI-Toggle disabled).
- Velocity-Limit: max. 5 qualifizierte Referrals pro referrer/Monat.
- Self-Referral blockiert: 422 SELF_REFERRAL_BLOCKED.

---

## Ergänzende Hinweise

- Alle Prozesse erzeugen WORM-Audit-Events (device.register, stamp.token.issued, stamp.claimed, reward.redeemed, referral.*).  
- Error-Handling folgt RFC 7807; correlation_id dient dem Support.  
- Prozesse sind Grundlage für UAT (Roadmap Schritt 12 & 40) und E2E-Tests (Schritt 39).  
- Diagramme dienen auch als Referenz für Runbooks (Replay-Suspected, JWKS-Rotation) und CI-Gates (Anti-Replay, Device-Proof).
