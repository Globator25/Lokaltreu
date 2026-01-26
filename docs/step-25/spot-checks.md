# Step 25 – Reporting APIs – Spot Checks (DoD Evidence)

## Mock-first / Prism
- Started Prism mock on 127.0.0.1:4010 using apps/api/openapi/lokaltreu-openapi-v2.0.yaml
- Summary: GET /admins/reporting/summary -> 200
- Timeseries: GET /admins/reporting/timeseries -> 200

## Tests / Quality Gates
- npm test --workspaces -- --coverage -> PASS
- spectral lint openapi -> PASS

## Notes
- No breaking contract changes beyond OpenAPI SSOT.
- Tenant isolation verified via test suite.
- DSR tombstones excluded from aggregates (see reporting DSR integration test).


