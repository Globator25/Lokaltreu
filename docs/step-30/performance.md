# Schritt 30 – Performance Check (Admin Dashboard)

## Lighthouse Run

Zielseite: /admin/dashboard

Beispiel (lokal):

```bash
npx lighthouse http://localhost:3000/admin/dashboard \
  --preset=desktop \
  --output=html \
  --output-path=artifacts/step-30/lighthouse-admin-dashboard.html
```

Artefaktpfad:
- artifacts/step-30/lighthouse-admin-dashboard.html

## Hinweise

- Timeseries ist lazy-loaded (Next.js dynamic), um LCP nicht zu belasten.
- Keine Overfetching-Schleifen: Requests nur bei Aenderung von metric/bucket/from/to.

## Ergebnisse

- Datum/Zeit (lokal):
- Lighthouse Performance Score:
- LCP:
- INP:
- CLS:
- Top 3 Opportunities:
  - 
  - 
  - 
