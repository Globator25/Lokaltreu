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

## Leitprinzipien  
- **Radikale Einfachheit**: Jede Funktion sofort verständlich  
- **Sicherheit durch Automation**: Alerts, Audit, Limits  
- **Auditierbarkeit**: WORM-Logs, 180 Tage, signierte Exporte  
_Quelle: [DOC:REQ §2.3], [DOC:SPEC §2], [DOC:ARCH]_
