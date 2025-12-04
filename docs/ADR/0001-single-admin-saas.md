# ADR 0001 – Single-Admin-SaaS je Mandant

## Kontext

- Lokaltreu adressiert Solo-Selbstständige (Friseur-, Kosmetik-, Nagelstudios) mit minimaler Zeit und IT-Kapazität.
- Roadmap Schritt 1 fokussiert auf schnelle Einführung ohne komplexes Rollen-/Rechtemanagement.
- Mehrfach-Admins oder Teamrollen würden UI, Datenmodell (Role Tables, Invitations) und Compliance-Prüfungen erheblich aufblähen.
- Betreiberpflichten (Audit, Anti-Replay, DSR) bleiben überschaubarer, solange genau eine verantwortliche Person pro Tenant existiert.

## Entscheidung

Pro Mandant existiert exakt ein Admin-Account mit voller Kontrolle über Kampagne, Geräte und Reporting. Team-Admins, Delegationen oder Rollenmodelle werden nicht implementiert; Mitarbeitergeräte arbeiten ausschließlich mit gerätegebundenen Scopes.

## Konsequenzen

### Positiv

- UX bleibt radikal einfach: kein Rollen-Wizard, keine Einladungsflows, geringere Support-Last.
- Sicherheit/Compliance profitieren: eindeutige Verantwortlichkeit, klare Audit-Pfade, weniger Angriffsfläche durch zusätzliche Accounts.
- Datenmodell bleibt schlank (eine `tenant_admin` Entität, keine Join-Tabellen), was Schema-Drift-Risiko reduziert.

### Negativ

- Kein Delegationsmodell: Urlaubsvertretungen oder Teams müssen das eine Admin-Konto teilen → erhöhtes Risiko bei Credential-Sharing.
- Skalierung auf größere Betriebe erschwert; spätere Einführung von Rollen verlangt Migrationen (Tables, APIs, Device-Flows).
- Support muss Workarounds für Kund:innen mit mehreren Filialen abstimmen (z. B. getrennte Tenants).
