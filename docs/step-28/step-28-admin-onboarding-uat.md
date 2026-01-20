\# Step 28 – Admin-Onboarding (Mock-First) – UAT Protokoll



\## Ziel

Nachweis, dass das Admin-Onboarding (Wizard 1–3) im Frontend läuft, ohne Real-Backend, gegen Prism Mock (OpenAPI SSOT).



\## Setup (Lokale Umgebung)

\- Repo: Lokaltreu-clean

\- Node: v22.12.0

\- npm: 11.7.0

\- Web: http://localhost:3000

\- Prism: http://127.0.0.1:4010

\- Spec: apps/api/openapi/lokaltreu-openapi-v2.0.yaml

\- Web Upstream: LOKALTREU\_API\_UPSTREAM=http://127.0.0.1:4010



\## Start-Kommandos



\### Prism starten

```powershell

cd C:\\Users\\user\\Projects\\Lokaltreu-clean

$spec = (Resolve-Path .\\apps\\api\\openapi\\lokaltreu-openapi-v2.0.yaml).Path

npx prism mock "$spec" -p 4010



