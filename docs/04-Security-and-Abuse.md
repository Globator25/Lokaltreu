# Security & Abuse

## Leitplanken
- Single-Admin-Architektur; keine Team-Rollen. [ROADMAP]
- Token-Einmaligkeit (jti), kurze TTLs, Idempotency-Key. [SPEC]
- Device-Proof (Ed25519) für sensible Aktionen. [SPEC]
## Audit & Logging
WORM-Audit; signierte Exporte; Aufbewahrung 180 Tage. [SPEC, ROADMAP]
## Rate-Limits (Beispiele)
Mandant, IP, Hot-Routen (/stamps/claim, /rewards/redeem). [SPEC]
