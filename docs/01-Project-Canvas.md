# Projekt-Canvas: Lokaltreu

## Vision  
Lokaltreu ersetzt veraltete Papier-Stempelkarten durch ein maximal vereinfachtes, sicheres und vollständig digitales Treuesystem, das speziell auf die Bedürfnisse von Inhabern lokaler Kleinstunternehmen zugeschnitten ist.  
_Quelle: [DOC:REQ §2.1]_

## Zielgruppe  
- Inhaber von Friseursalons, Kosmetikstudios, Nagelstudios  
- Einzelunternehmer mit wenig Zeit und ohne technisches Vorwissen  
_Quelle: [DOC:REQ §2.2]_

## Akteure  
- **Admin (Inhaber)**: Volle Kontrolle über Kampagne, Geräte, Reporting  
- **Mitarbeiter**: Gerätgebunden, keine Login-Daten, zwei Aktionen  
- **Endkunde**: Anonym, scannt QR, sieht Karte, löst Prämie ein  
_Quelle: [DOC:SPEC §3], [DOC:REQ §3.1]_

## Scope  
- Geltungsbereich: Deutschland  
- Datenverarbeitung: ausschließlich in der EU  
- In-Scope: QR-Logik, Gerätebindung, Reporting, Audit, DSGVO, Referral  
_Quelle: [DOC:SPEC §1]_

## Out-of-Scope  
- Keine monetären Auszahlungen  
- Keine Zahlungsdienstleister  
- Keine Mehrfach-Admins oder Rollenmodelle  
- Keine parallelen Kampagnen je Mandant  
_Quelle: [DOC:SPEC §1], [DOC:REQ §7]_

## Leitprinzipien & Architektur  
- **Single-Admin-Design:** Eine verantwortliche Person pro Mandant.  
- **Radikale Einfachheit:** Jede Funktion sofort verständlich; UI-Entscheidungen werden per UAT validiert.  
- **Security & Privacy by Design:** Device-Proof, Rate-Limits, Idempotenz, Art. 6 Abs. 1 lit. f DSGVO.  
- **Sicherheit durch Automation:** Alerts, Audit, Limits.  
- **Auditierbarkeit:** WORM-Logs, 180 Tage, signierte Exporte, Break-Glass nur dokumentiert.  
- **PWA-first:** Offline-fähige PWA mit Service-Worker, Lighthouse ≥ 90.  
_Quelle: [DOC:REQ §2.3], [DOC:SPEC §2], [DOC:ARCH], [AGENTS §1–§5], [ROADMAP Schritte 27–36]_

## Erfolgskennzahlen & Qualitätsziele  
- Onboarding inkl. erster Kampagne < 5 Minuten (US-1).  
- Performance: /stamps/claim und /rewards/redeem p95 ≤ 3 s, SLO 99,90 % (30 Tage).  
- Coverage ≥ 80 %, schema_drift = 0, Problem+JSON zu 100 % konform.  
- Observability: cost_per_tenant, plan_usage_percent, Fehlscan-Spikes.  
- Compliance: GDPR-/Security-Gates grün, dokumentierter Break-Glass-Fluss.  
_Quelle: [SPEC §6, §19], [ROADMAP Schritte 37–45], [AGENTS §6–§7], [CI-Gates]_

## UX Prototyping & frühes UAT (Schritt 12)
Frühe Nutzer:innen-Tests (Schritt 12 der Roadmap) validieren die Hypothesen dieses Canvas mit realen Admins/Mitarbeiter:innen. Protokolle, Findings und handlungsleitende UX-Entscheidungen werden in [docs/ux/step-12/README.md](./ux/step-12/README.md) und [UX-Decisions-Schema-Impact](./ux/step-12/UX-Decisions-Schema-Impact.md) dokumentiert.
