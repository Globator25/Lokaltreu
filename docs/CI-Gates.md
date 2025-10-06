# CI-Gates

Kurzbeschreibung der verpflichtenden Gates für dieses Repository.

## Ziele
- Fehler früh stoppen, Nachweise verlinken, EU-Deploys schützen.  
- Deckung der SPEC/ROADMAP-Vorgaben: OpenAPI 3.1 + RFC 7807, Coverage ≥ 80 %, SLO-Nachweise verlinkt.  
	Quellen: docs/CI-Gates.md (dieses Dokument), .github/workflows/*.yml.  

## Muss-Kriterien (hard fail)
1) **Lint**: ESLint/Format fehlerfrei.  
2) **Build**: `apps/web`, `apps/api` bauen erfolgreich. :contentReference[oaicite:5]{index=5}  
3) **Tests**:  
	 - Unit-Coverage **≥ 80 %** (Pflicht).   
	 - Contract-Tests grün (gegen OpenAPI 3.1). :contentReference[oaicite:7]{index=7}  
4) **OpenAPI-Lint**: `lokaltreu-openapi-v2.0.yaml` ist 3.1-valide, Lint „pass“. :contentReference[oaicite:8]{index=8}  
5) **Problem+JSON**: Fehlerobjekt gemäß RFC 7807 vorhanden (Schema/Beispiel geprüft). :contentReference[oaicite:9]{index=9}  
6) **Artefakte**: `dist/` und `coverage/` hochgeladen. :contentReference[oaicite:10]{index=10}

## Beispiel-Checks (Referenzbefehle)
```bash
npm ci
npm run lint --workspaces
npm run build --workspaces
npm test --workspaces -- --coverage
npx @redocly/cli lint apps/api/openapi/lokaltreu-openapi-v2.0.yaml
```



## Artefakte & Nachweise (im CI-Run verlinken)

* **Coverage-Report** → <CI-RUN-URL>/artifacts (Ziel: ≥ 80 %). 
* **OpenAPI-Lint-Log** → <CI-RUN-URL>/logs (Ergebnis: pass). 
* **Build-Artefakte (`dist/`)** → <CI-RUN-URL>/artifacts. 

> Ersetze `<CI-RUN-URL>` nach jedem Merge/PR-Run.

## Durchsetzung

* PRs gegen `main` triggern `ci.yml`; Merge nur bei grünen Gates (required checks).
* Deploy via `deploy.yml` nur für **dev/stage/prod**; EU-Regionen verbindlich. 

## Links

* Workflow: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml` (Blue-Green/Canary vorbereitet). 

