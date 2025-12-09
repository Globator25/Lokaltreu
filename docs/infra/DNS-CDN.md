# DNS & CDN (EU Regional Services)

| Subdomain | Zweck | Provider / Region | Hinweise |
| --- | --- | --- | --- |
| `api.<tenant>.lokaltreu.*` | Mandanten-spezifische API (Admin + Mitarbeiter) | Fly.io (eu-central) über Anycast, Origin-Pinning auf EU | TLS-Termination in EU; keine Routen ausserhalb EU; HSTS aktiv |
| `app.lokaltreu.*` | Admin-Portal & PWA | Cloudflare CDN mit Regional Services (EU only) | Caching für statische Assets, Service-Worker liefert PWA; Fallback auf Origin in EU |
| `pwa.lokaltreu.*` (optional CNAME) | Direktzugriff Endkunden-PWA | Cloudflare CDN (EU) | Nur HTTPS; manifest + SW; optional subresource integrity |
| `status.lokaltreu.*` | Öffentliche Status-Page | getstatuspage (EU Region) oder eigenständiger EU-Host | Muss unabhängig von Haupt-Infrastruktur erreichbar sein |

Weitere Regeln:
- DNS liegt bei Cloudflare mit CNAME-Setup, aber Datenverarbeitung per Regional Services ausschließlich in EU.  
- Kein Edge-Processing außerhalb EU (Workers deaktiviert bzw. auf EU-Region beschränkt).  
- TXT-Records für SPF/DMARC nur mit EU-basierten Mailanbietern (Mailjet/Brevo).  
- Zertifikate via ACME (Let’s Encrypt) oder Cloudflare SSL (EU key storage).  
- Logging/Analytics nur auf EU-Datenzentren aktivieren.
