# ADR-0001: Keine Mehrfach-Admins

## Status
Entschieden – gültig ab Projektstart (siehe Roadmap Phase 1, Schritt 1)

## Entscheidung
Das Lokaltreu-System erlaubt **pro Mandant nur einen Admin**. Es existieren weder Mehrfach-Admins noch delegierte Rollen mit vergleichbaren Rechten. Der Admin repräsentiert immer den Inhaber des lokalen Geschäfts.

## Kontext
- Zielgruppe sind Einzelunternehmer (Friseure, Kosmetik-, Nagelstudios) ohne IT-Team.  
- Onboarding (US-1) muss < 5 Minuten dauern; zusätzliche Rollen würden Setup und Supportaufwand erhöhen.  
- Security-/Compliance-Kontrollen (Alerts, Audit, DSR, Plan-Limits) referenzieren exakt eine verantwortliche Person.  
- Roadmap & SPEC definieren Single-Admin als Muss-Kriterium für MVP-Go-Live.

## Begründung

- **Radikale Einfachheit & UX**  
  Mehrere Admins würden UI-Navigation, Berechtigungsmodelle und Onboarding-Dialoge stark verkomplizieren und die Zielgruppe überfordern.

- **Security & Audit**  
  Geräte-Onboarding, Stempel-/Redeem-Freigaben und Break-Glass-Aktionen müssen eindeutig einem Verantwortlichen zugeordnet werden. Mehrfach-Admins verwässern den Audit-Trail und erschweren Incident-Analysen.

- **Alerting & Compliance**  
  Security-Alerts (Gerätebindung, Plan-Limits 80/100 %) sowie DSGVO-Benachrichtigungen laufen auf eine definierte Adresse. Mehrere Empfänger führen entweder zu Alert-Verlust (Spamfilter) oder zu ungesteuertem Verteileraufwand.

- **Plan- & Geschäftsmodell**  
  Preispläne basieren auf Single-Admin-Prozessen (Upgrade, Referral-Toggle). Ein Rollenmodell würde zusätzliche Limits, Billing-Logik und Supportfälle erzeugen, die außerhalb des MVP-Scopes liegen.

## Alternativen (verworfen)
- **Delegated Admin / Mitarbeiter mit eingeschränkten Rechten**  
  Würde faktisch ein Rollenmodell einführen, inklusive Zugriffsverwaltung, Device-Proof-Ausnahmen und zusätzlicher Datenverarbeitung – widerspricht SPEC- und Roadmap-Vorgaben.
- **Temporäre Gast-Admins**  
  Erhöht Missbrauchspotenzial (Token-Sharing, Replay) und verkompliziert Break-Glass-Verfahren.

## Konsequenzen
- Support & Runbooks adressieren ausschließlich den Admin/Inhaber.  
- Alle CI-Gates prüfen Single-Admin-Annahmen (z. B. kein Team-Menü, keine API-Routen für Multi-Admins).  
- Feature-Anfragen zu Multi-Admin werden konsequent in spätere Phasen verschoben und benötigen neues ADR.

## Referenzen

- [SPEC §2.3, §3.1, §7] – Rollenmodell & Design-Prinzipien  
- [ROADMAP 2.3.1 Schritt 1, 31] – Single-Admin-Leitplanke  
- [AGENTS §1–§2] – Produktleitplanken, Rollen  
- [lokaltreu-agents-goldstandard.md §2] – Governance & Rollenmodell
