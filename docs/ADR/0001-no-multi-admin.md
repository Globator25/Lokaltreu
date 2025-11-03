# ADR 0001 — Kein Multi-Admin

- **Status**: Accepted
- **Kontext**: Zielgruppe Einzelunternehmer; radikale Einfachheit; Risiko- und Supportreduktion. [SPEC]
- **Entscheidung**: Pro Mandant genau ein Administrator. Keine Team-/Rollenverwaltung.
- **Konsequenzen**: Einfachere UX, weniger Angriffsfläche; spätere Erweiterung via neues ADR. 
- **DoD-Checks**: UI ohne Team-Menüs; DB-Constraint „eine aktive Kampagne je Mandant“ wirkt unabhängig. [SPEC]
- **Verweise**: Roadmap 2.2 Schritt 1; SPEC v2.0. [ROADMAP, SPEC]
