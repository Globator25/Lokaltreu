# Compliance – Lokaltreu

Kurzüberblick über rechtliche Leitplanken gemäß DSGVO, SPEC v2.0 und ROADMAP Schritt 1.

## Rechtsgrundlage

- Verarbeitung stützt sich auf **Art. 6 Abs. 1 lit. f DSGVO** (berechtigtes Interesse) für Betrieb, Sicherheit, Anti-Fraud und Audit-Pflichten des digitalen Treuesystems.
- Interessenabwägung dokumentiert in DPIA; Verantwortlicher stellt sicher, dass Endkund:innen über Zweck informiert werden (Portal-Hinweis).

## Logs & Retention

- Betriebs- und Security-Logs gelten als personenbezogene Daten (Geräte-ID, card_id) und werden wie solche behandelt.
- Speicherfrist für Logs/Audit = **180 Tage**; Umsetzung via WORM-Speicher + tägliche Retention-Jobs, danach automatische Löschung.
- WORM-Exporte (signierte R2-Archive) stehen Aufsichtsbehörden oder Kund:innen auf Anfrage zur Verfügung; jede Ausspielung erhält Audit-Referenz.

## DSR (Art. 11 DSGVO)

- System führt keine zusätzliche Identifizierung durch; DSRs nutzen vorhandene Kontexte (card_id, device_id, tenant channel).
- Request erfolgt über Admin-Portal (`POST /compliance/dsr-requests`); Matching über Stempel-/Gerätelogik, keine neuen Merkmale.
- Antworten erfolgen innerhalb 30 Tagen per signiertem Export; Nachweis über Audit-Log.

## Consent & UI

- Nur technisch notwendige Cookies/LocalStorage (Session, Device-Keys, QR-Tokens) – kein Consent-Banner erforderlich.
- PWA zeigt Pflicht-Hinweis zu berechtigtem Interesse und verweist auf Datenschutzhinweise; keine Marketing-/Tracking-Cookies erlaubt.

## Artefakte (Schritt 2)

- Detaildokumente (AVV, TOMs, RoPA, DPIA, Retention-Policy, Audit-Playbooks) werden im Governance-Schritt 2 als separate Dateien geführt und versioniert.
- Dieses Dokument verweist auf deren Existenz; Bereitstellung erfolgt auf Anforderung durch Audit-Officer/Legal.
