# Projekt-Canvas: Lokaltreu

## Titel

Digitale QR-Stempelkarte als PWA für lokale Kleinstunternehmen in Deutschland; Single-Admin-Betrieb ohne Zahlungsdienstleister.

## Vision

Papierlose, fälschungsarme Treuekarte, die sofort einsatzbereit ist und ohne externe Zahlungsabwicklung auskommt.

## Zielgruppe

- Inhaber:innen von Friseur-, Kosmetik-, Nagel- und ähnlichen Einzelbetrieben mit minimaler IT-Kapazität

## Scope

- **Fachlich:** Ein Mandant mit genau einem Admin; QR-Scan für Stempel und Einlösung; Gerätebindung pro Mitarbeitergerät; einfaches Reporting; Referral-Flow; DSGVO-konformes Logging (WORM, 180 Tage).
- **Technisch:** Modularer Monolith (Next.js PWA + Node.js API) auf EU-PaaS; OpenAPI 3.1 + RFC 7807; Postgres (SoT), Redis (Rate/Anti-Replay/Idempotency), R2 für signierte Exporte, CDN für statische/QR-Assets; Anti-Replay und Device-Proof (Ed25519) verpflichtend.

## Nicht-Ziele

- Keine Zahlungsabwicklung oder PSP-Integrationen
- Keine Mehrfach-Admin- oder Rollenmodelle
- Keine parallelen Kampagnen pro Mandant
- Keine Multi-Region-Betriebe außerhalb der EU

## Architekturprinzipien

- **Ein Codepfad:** Modularer Monolith hält Domain und API konsistent; Schema-Drift=0.
- **API-first:** OpenAPI-gestützt, Fehler strikt RFC 7807 mit gepflegten `type/error_code`.
- **Sicherheit by Default:** Device-Proof, Anti-Replay mit Idempotency-Key, strenge TTLs, EU-Datenhaltung.
- **Betriebssimpel:** Gemanagte Postgres/Redis/R2/CDN auf EU-PaaS; automatisiertes Audit (WORM, 180 Tage), signierte Exporte.

## Risiken/Annahmen

- Single-Admin-Annahme bleibt stabil; Rollenwünsche würden Scope sprengen.
- QR-Missbrauch: Abhängig von sauberer Gerätebindung, Rate-Limits und Idempotency-Konfiguration.
- Offline-Szenarien eingeschränkt; PWA muss Degradationspfade klar kommunizieren.
- DSGVO/Audit: PII in Logs vermeiden, WORM-Setup und Retention laufend überwachen.
- Skalierung: Spitzen abhängig von PaaS-Limits und Cache-Strategie (CDN/Redis) – Kapazitätsplanung früh klären.
