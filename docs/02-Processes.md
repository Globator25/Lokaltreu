# Kernprozesse: Lokaltreu

Dieses Dokument beschreibt die vier zentralen Geschäftsprozesse von Lokaltreu anhand von Sequenzdiagrammen gemäß [DOC:SPEC §5].

---

## 1. Geräte-Onboarding (Registrierung eines Mitarbeiter-Geräts)

```mermaid
sequenceDiagram
participant Admin
participant Portal
participant API
participant Mail
participant Device

Admin->>Portal: Neues Mitarbeiter-Gerät
Portal->>API: POST /devices/registration-links (TTL=15m)
API-->>Portal: 201 {link, qr}

Device->>API: GET /devices/register?token
API-->>Device: Bestätigungsseite

Device->>API: POST /devices/register/confirm
API->>Mail: Sicherheits-Alert an Admin
