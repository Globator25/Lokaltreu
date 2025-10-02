# ADR-0001: Keine Mehrfach-Admins

## Status
Entschieden – gültig ab Projektstart

## Entscheidung
Das Lokaltreu-System erlaubt **pro Mandant nur einen Admin**. Es gibt keine Mehrfach-Admins oder Rollen mit vergleichbaren Rechten.

## Begründung

- **UI-Vereinfachung**  
  Die Admin-Oberfläche ist für Einzelunternehmer konzipiert. Mehrfach-Admins würden komplexe Rechte- und Navigationslogik erfordern, die nicht zur Zielgruppe passt.

- **Auditpflicht**  
  Alle sicherheitsrelevanten Aktionen (z. B. Geräte-Onboarding, Prämieneinlösung) müssen eindeutig einem Verantwortlichen zugeordnet werden.  
  Mehrfach-Admins würden die Nachvollziehbarkeit und Verantwortlichkeit verwässern.

- **Alerting**  
  Sicherheitswarnungen (z. B. bei Gerätezugriffen oder Redeems) werden an eine feste Admin-Mail gesendet.  
  Mehrfach-Admins würden zu Alert-Verlust oder Alert-Flut führen.

## Referenzen

- [DOC:SPEC §3.1] – Rollenmodell: Admin, Mitarbeiter, Endkunde  
- [DOC:SPEC §5.2] – Geräte-Onboarding: Sicherheits-Alert an Admin  
- [DOC:ARCH §2.3] – Auditlog: eindeutige Zuordnung zu Mandant  
- [DOC:REQ §2.2] – Zielgruppe: Einzelunternehmer ohne IT-Abteilung
