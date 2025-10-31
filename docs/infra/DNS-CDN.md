# DNS & CDN (EU Regional Services)

## Zonen und Origin-Mapping
- `api.<tenant>.lokaltreu.*` → Origin: **Fly.io** (Region: eu-central), API /v1  
- `app.lokaltreu.*` → **Next.js PWA** via **Cloudflare CDN**, Regional Services: EU aktiv

## TLS- und Datenschutz-Konfiguration
- **TLS-Terminierung ausschließlich in EU-Regionen** (Cloudflare Regional Services).  
- **Kein Edge-Processing oder Routing außerhalb der EU.**  
- Ziel:
  - **Datenschutz:** Vermeidung von Datenübermittlung in Drittländer (Art. 44 ff. DSGVO).  
  - **Leistung:** Geringere Latenz und stabilere Antwortzeiten für PWA-Assets.  
  - **Nachvollziehbarkeit:** Alle Origins und TLS-Endpunkte dokumentiert.

## Verknüpfte Dokumentation
Siehe **PROVIDERS.md**, Abschnitt *Cloudflare R2 (EU-Jurisdiction) + CDN Regional Services*,  
für Audit-Retention (180 Tage WORM, signiert) und technische Referenz der CDN-Dienste.

