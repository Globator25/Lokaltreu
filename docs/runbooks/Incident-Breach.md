# Runbook: Incident / Data Breach (72h-Pfad)

## 1. Zweck und Scope

- Behandlung von Sicherheitsvorfällen und möglichen Datenschutzverletzungen (Data Breach) im Lokaltreu SaaS.

## 2. Definition "Incident" vs. "Data Breach"

- Incident: Abweichung vom Normalbetrieb mit potenzieller Auswirkung auf Sicherheit oder Verfügbarkeit (z. B. unautorisierter Zugriff, Rate-Limit Umgehung).
- Data Breach: Incident mit bestätigtem Verlust/Verletzung personenbezogener Daten (z. B. tenant_id/device_id/card_id Leak, unbefugter Log-Export).

## 3. Erstreaktion (0–4 Stunden)

- Incident melden (interner Kanal, Owner: Security-Engineer/Audit-Officer)
- Break-Glass-Team aktivieren, Rolle Incident-Commander zuweisen
- Sofortige Sicherungsmaßnahmen (Token/API-Keys sperren, Sessions revoken)
- Logs mit tenant_id/device_id/card_id sichern (Read-only Snapshot, 180 Tage Retention beachten)
- Backups einfrieren (keine selektive Bearbeitung), Änderungsstop kommunizieren

## 4. Analyse und Eindämmung (4–24 Stunden)

- Ursache identifizieren (Timeline, Entry-Point, Exploitpfad)
- Betroffene Systeme, Händler-Tenants, Datenkategorien bestimmen
- Prüfen, ob personenbezogene Daten betroffen sind (insb. Logs, Rohzähler, cached Rewards)
- Eindämmung: Patches, Feature-Flags, Rate-Limit-Schrauben, Idempotency-/Device-Proof-Checks
- Nachvollziehbarkeit: alle Schritte im Incident-Log dokumentieren, keine Backups anfassen

## 5. Bewertung Meldepflicht (24–48 Stunden)

- Prüfen, ob Data Breach vorliegt (Vertraulichkeit/Integrität/Verfügbarkeit betroffen)
- Risikoanalyse: Anzahl Betroffene, Kategorien (tenant_id, device_id, card_id), potenzielle Folgen
- Entscheidung mit Legal/Privacy-Team abstimmen (Art. 33 / Art. 34 Trigger)
- Dokumentation: Entscheidungsnotiz, Indikatoren, geplante Maßnahmen
- Parallel: vorbereiten, welche Daten für Art.-11-DSR relevant sind (Card-/Device-Matching)

## 6. Meldung und Information Betroffener (bis 72 Stunden)

- Meldung an Aufsichtsbehörde (Art. 33) inkl. Incident-ID, Zeitraum, betroffene Datenkategorien, Maßnahmen
- Betroffene Händler/Endkunden informieren (Art. 34) soweit Risiko hoch; Inhalt: was passiert ist, welche Daten, Kontaktdaten
- Hinweis, dass keine zusätzliche Identifizierung erfolgt (Art. 11); Anfragen via Card-/Device-ID
- Ansprechpartner: privacy@lokaltreu.example (TODO finalisieren), Security-Hotline
- Sicherstellen, dass Logs/Backups unverändert bleiben; relevante Auszüge als WORM-Audit exportieren

## 7. Nachbereitung und Lessons Learned

- Runbooks, TOMs, DPIA, Infos-DE, Retention-Policy aktualisieren (Change-Log pflegen)
- Review mit Dev/Security/Audit-Officer: Ursachen, Gegenmaßnahmen, Testfälle (Anti-Replay, Device-Proof)
- DSR-Folgen prüfen: Tombstone-Liste `deleted_subjects` ergänzen, Wiederanwendung nach Restore testen
- Break-Glass-Protokolle in AGENTS.md referenzieren; Governance-Board informieren
- Lessons Learned verbreiten (Post-Mortem), offene Tasks in ROADMAP einplanen
