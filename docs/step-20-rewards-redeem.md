# STEP 20 — POST /rewards/redeem (Redeem-Flow, Idempotency & Anti-Replay)

Dieser Schritt implementiert und härtet den Endpunkt:

```

POST /rewards/redeem

````

Ziel: Rewards dürfen **genau einmal** eingelöst werden — auch bei Netzwerk-Retries, parallelen Requests oder absichtlichen Replay-Versuchen.

---

## 1. Funktionaler Überblick

### Request Body

```json
{
  "redeemToken": "string"
}
````

* exakt ein Feld
* `additionalProperties: false`

### Responses

| Status  | Bedeutung                              |
| ------- | -------------------------------------- |
| **200** | Reward erfolgreich eingelöst           |
| **400** | Token abgelaufen (`TOKEN_EXPIRED`)     |
| **403** | Device-Proof ungültig                  |
| **409** | Token erneut verwendet (`TOKEN_REUSE`) |
| **429** | Rate-Limit (Gerät oder Tenant)         |

Alle Fehler werden als **RFC7807 Problem+JSON** zurückgegeben.

---

## 2. Sicherheitsmechanismen

### 2.1 Device-Proof

Der Client signiert folgende Zeichenkette:

```
POST|/rewards/redeem|<timestamp>|<jti>
```

Der Server prüft:

* gültiger Public Key
* Zeitabweichung (Skew)
* Nonce-/Replay-Schutz

Replay → **409 DEVICE_PROOF_REPLAY**.

---

### 2.2 Idempotency

Header:

```
Idempotency-Key: <uuid>
```

Verhalten:

* identische Wiederholungen → **cached 200**
* parallele Requests → **409** (Konflikt)
* auch Fehler-Antworten werden gecached (Problem+JSON)

---

### 2.3 Rate-Limits

Die Route ist individuell limitiert (Device / Tenant).
Bei Überschreitung:

```
429 RATE_LIMITED
Retry-After: <seconds>
```

---

## 3. OpenAPI-Contract (Quick-Check)

Datei:

```
apps/api/openapi/lokaltreu-openapi-v2.0.yaml
```

Verifiziert:

* `POST /rewards/redeem` dokumentiert
* Request-Body: nur `redeemToken`
* Problem-Schema enthält relevante `error_code`-Werte
* `429RateLimited` ist referenziert
* `X-Device-Timestamp` als globaler Parameter modelliert

Validierung:

```bash
npm run contract:check
```

Erwartung: **grün**

---

## 4. Tests

### 4.1 Nur Redeem-Integrationstests

```bash
cd apps/api
npm test -- rewards.http.spec.ts
```

Abgedeckt:

* 403 invalid proof
* 400 TOKEN_EXPIRED
* 409 TOKEN_REUSE
* Parallelredeem (einmal OK, Rest blockiert)
* Idempotency-Replay (cached 200)
* forwarded path handling
* falscher Pfad → rejected

---

### 4.2 Gesamte API-Suite

```bash
npm test
```

Erwartung: **alle Tests grün**.

---

## 5. Security-Checks

API im Test-Profil:

```bash
npm run security:api:start
```

Dann:

```bash
npm run test:security:anti-replay
npm run test:security:device-proof
npm run test:security:plan-gate
```

Ziel: **Exit-Codes 0**
(erkannte „Known Issues“ sind dokumentiert und nicht regressionskritisch).

---

## 6. Infrastruktur-Abhängigkeiten

* Redis läuft (IdempotencyStore + ReplayStore):

```bash
docker exec lokaaltreu-redis redis-cli PING
# Erwartung: PONG
```

* Mock-Server optional:

```bash
npm run mock:api
```

---

## 7. CI-Quality Gates (sollen grün sein)

* Contract-Check
* RFC7807-Check
* Unit + Integration
* Security-Checks
* Build (API + Web)

---

## 8. Abschluss

Commit & Push:

```bash
git add .
git commit -m "Step 20: secure POST /rewards/redeem (idempotency, anti-replay, rate limits)"
git push origin feat/step20-rewards-redeem
```

PR-Beschreibung (Kurzfassung):

* Redeem-Flow implementiert
* Idempotency + Anti-Replay integriert
* Rate-Limits dokumentiert
* Contract konform
* Security- und Integrationstests grün
* Keine Breaking Changes (expand-contract)

---

**Step 20 ist erfolgreich abgeschlossen, wenn:**

* Contract sauber, Tests grün
* Device-Proof & Replay-Schutz wirksam
* Idempotency vorhersehbar
* Rate-Limits sichtbar
* CI-Pipeline fehlerfrei

