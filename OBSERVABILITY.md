# Observability

## Anti-Replay / rate_token_reuse
- Jeder sicherheitsrelevante Request fuehrt eine JTI (Nonce) im Header.
- Die Route `POST /secure-action` prueft jeden JTI via Redis `SETNX` mit `TTL=60s`.
- Bei Wiederverwendung wird die Metrik `rate_token_reuse` erhoeht und ein RFC7807-Fehler zurueckgegeben.
- Observability ueberwacht diese Metrik fuer Missbrauchsspitzen in Echtzeit gemaess SPEC.

## Alerts / Security SLOs
- Latenz p95 > 3000 ms: Alarm in Grafana, kennzeichnet Verletzung des Latenz-SLO der Kernrouten.
- `rate_token_reuse` Spike: Hinweis auf Replay- oder Bot-Angriffe; Echtzeit-Reaktion erforderlich.
- `deviceProofFailed` Spike: Hinweis auf ungueltige oder manipulierte Device-Proofs aus `verifyDeviceProof`.
- Kein Audit-Export nach R2 in den letzten 15 Minuten: potentieller RPO-Verstoss; Incident nach ARCH.

Alle Metriken stammen direkt aus `/secure-action` und `verifyDeviceProof`, die sowohl Telemetrie als auch Audit-Ereignisse ausloesen.
