# Security Agents Runbook

- **Anti-Replay (Roadmap Schritt 16)**  
  - `REPLAY_STORE=redis` MUSS in Produktion gesetzt sein (Upstash Redis EU, SETNX + EX 60s).  
  - `REPLAY_STORE=memory` ist ausschließlich für lokale Entwicklung/Tests erlaubt.  
  - `rate_token_reuse` Counter MUSS bei jedem Replay-Incident erhöht werden (Alert-Gate in Observability).

- **Device Proof (Roadmap Schritt 15)**  
  - `verifyDeviceProof` erzwingt ±60s Fenster auf `x-device-timestamp`. Verstöße → 403 `DEVICE_PROOF_INVALID_TIME`.  
  - Erfolgreiche Proofs erzeugen `secure_device.ok`, Fehlschläge `secure_device.proof_failed` (Audit-WORM, Pflichtfelder siehe docs/security/audit-log.md).  
  - `deviceProofFailed` Metric MUSS bei jedem Fehlversuch emittiert werden.

- **Audit-Härtung (Roadmap Schritt 14)**  
  - Audit-Events werden append-only in `./var/audit/*.jsonl` geschrieben, `flushAuditLogs()` exportiert signiert nach Cloudflare R2 (EU, 180 Tage).  
  - Produktions-Error-Logs dürfen keine Roh-IP / User-Agent enthalten – ausschließlich `correlation_id` und Metadaten ohne PII.  
  - PII (IP/UA) nur im Audit-Log hinterlegt (Art. 6 Abs. 1 lit. f, Art. 11 DSGVO).
