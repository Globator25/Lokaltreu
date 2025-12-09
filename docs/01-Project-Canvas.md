# Projekt-Canvas: Lokaltreu

## Vision  
Lokaltreu ersetzt veraltete Papier-Stempelkarten durch ein maximal vereinfachtes, sicheres und vollständig digitales Treuesystem, das speziell auf die Bedürfnisse von Inhabern lokaler Kleinstunternehmen zugeschnitten ist.  
_Quelle: [SPEC §2.1]_

## Problem & Bedarf  
- Papier-Stempelkarten verursachen hohen manuellen Aufwand, sind leicht zu manipulieren und liefern keinerlei Echtzeit-Blick auf den Kampagnenerfolg.  
- Einzelunternehmer verfügen weder über Zeit noch über IT-Know-how für komplexe Loyalty-Tools; das Onboarding muss in < 5 Minuten gelingen.  
- Sicherheit (Anti-Replay, Gerätebindung) und DSGVO-Konformität sind Pflicht, da keine zweite Kontrollinstanz existiert.  
_Quelle: [SPEC §2.2–2.3], [ROADMAP Schritt 12]_

## Zielgruppe  
- Inhaber von Friseursalons, Kosmetik- und Nagelstudios (Single-Admin-Design)  
- Solo-Entrepreneure mit knappen Ressourcen, die sofort einsatzbereite Digital-Tools benötigen  
- Fokusmarkt Deutschland mit deutschsprachiger UI  
_Quelle: [SPEC §2.2], [AGENTS §1]_

## Nutzenversprechen & Differenzierung  
- **Radikale Einfachheit:** Mitarbeiteroberfläche mit genau zwei Aktionen; Admin-Setup ohne Schulung.  
- **PWA-first:** Endkunden benötigen keine App und bleiben anonym/pseudonym.  
- **Security by Default:** Gerätebindung via Ed25519, Anti-Replay über jti+TTL, WORM-Audit mit 180 Tagen Retention.  
- **Plan-Treue ohne Sperre:** Warnung bei 80 %, kein Stopp bei 100 %, Upgrade möglich.  
_Quelle: [SPEC §2.3, §7, §16], [AGENTS §1], [ROADMAP Schritt 31]_

## Akteure  
- **Admin (Inhaber):** Konfiguriert Kampagne, autorisiert Geräte, erhält Reporting & Alerts.  
- **Mitarbeiter:** Gerätgebunden, kein Login, nur „Stempel vergeben“ und „Prämie einlösen“.  
- **Endkunde:** Anonym, scannt QR-Codes, sieht digitale Karte, löst Prämie ein, nutzt Referral-Link.  
_Quelle: [SPEC §3–§5]_

## Lösung & Kernfunktionen  
- Onboarding & Kampagne (US-1) in < 5 Minuten.  
- Geräteautorisation via einmaligem Link (TTL 15 Min) inkl. Sicherheits-E-Mail (US-2/US-3).  
- QR-basierte Stempel- und Prämienprozesse mit Anti-Replay (US-6–US-9).  
- Endkunden-PWA für Stempel, Prämien, Angebote, Referral (US-10–US-14).  
- Reporting & Plan-Monitoring (US-4, §16).  
_Quelle: [SPEC §4–§6, §15–§17], [ROADMAP Phase 2–3]_

## Scope  
- Fachlich: Digitale Stempelkarte inkl. Referral-Gate, Geräteverwaltung, Reporting.  
- Technisch: Hosting, Daten und Logs ausschließlich in EU-Regionen (Fly/Render, Neon, Upstash, R2).  
- Betriebsmodelle: Modularer Monolith (Next.js + Node.js), OpenAPI 3.1 als SSOT.  
_Quelle: [SPEC §1, §6–§8], [AGENTS §2], [ROADMAP §0.1]_

## Out-of-Scope  
- Mehrere Admin-Accounts oder Rollenmodelle („Team-Modus").  
- Proaktive Endkunden-Mailings, CRM oder POS-Integrationen.  
- Monetäre Auszahlungen oder Zahlungsdienstleister.  
- Parallele Kampagnen je Mandant (DB-Constraint).  
_Quelle: [SPEC §7], [AGENTS §1], [ROADMAP Phase 2]_

## Leitprinzipien & Architektur  
- **Single-Admin-Design:** Eine verantwortliche Person pro Mandant.  
- **Radikale Einfachheit:** UI-Entscheidungen werden per UAT validiert.  
- **Security & Privacy by Design:** Device-Proof, Rate-Limits, Idempotenz, Art. 6 Abs. 1 lit. f DSGVO.  
- **Auditierbarkeit:** WORM-Logs, signierte Exporte nach 180 Tagen, Break-Glass nur dokumentiert.  
- **PWA-first:** Offline-fähige PWA mit Service-Worker, Lighthouse ≥ 90.  
_Quelle: [SPEC §2, §7–§15], [AGENTS §1–§5], [ROADMAP Schritte 27–36]_

## Erfolgskennzahlen & Qualitätsziele  
- Onboarding inkl. erster Kampagne < 5 Minuten (US-1).  
- Performance: /stamps/claim und /rewards/redeem p95 ≤ 3 s, SLO 99,90 % (30 Tage).  
- Coverage ≥ 80 %, schema_drift = 0, Problem+JSON zu 100 % konform.  
- Observability: cost_per_tenant, plan_usage_percent, Fehlscan-Spikes.  
- Compliance: GDPR-/Security-Gates grün, dokumentierter Break-Glass-Fluss.  
_Quelle: [SPEC §6, §19], [ROADMAP Schritte 37–45], [AGENTS §6–§7], [CI-Gates]_
