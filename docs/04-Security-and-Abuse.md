# Security & Abuse – Lokaltreu

Dieses Dokument beschreibt die Sicherheitsarchitektur und Abuse-Prevention-Strategien für das Lokaltreu-System gemäß [DOC:SPEC §6], [DOC:ARCH], [DOC:REQ §7].

---

## 1. Authentifizierung

- **Admin-JWT**:  
  Mandanten erhalten ein signiertes JWT mit Rollen-Claims und Ablaufzeit.  
  Signatur: HMAC256, Rotation alle 24h.  
  _Quelle: [DOC:SPEC §6.1]_

- **Geräte-Schlüssel (Ed25519)**:  
  Mitarbeitergeräte registrieren sich mit einem einmaligen Link und erzeugen ein Ed25519-Schlüsselpaar.  
  Der Public Key wird im Backend gespeichert, der Private Key bleibt lokal.  
  _Quelle: [DOC:SPEC §6.2]_

- **X-Device-Proof**:  
  Jeder kritische API-Call (z. B. `/rewards/redeem`) muss mit einem signierten Header erfolgen:  
  `X-Device-Proof: sign(payload, devicePrivateKey)`  
  _Quelle: [DOC:SPEC §6.3]_

---

## 2. Token-Handling

- **QR-Token mit jti + TTL=60s**  
  Jeder Stempel-QR enthält einen eindeutigen Token (`jti`) mit kurzer Lebensdauer (60 Sekunden).  
  Token werden in Redis gespeichert und nach Ablauf automatisch invalidiert.  
  _Quelle: [DOC:SPEC §6.4]_

---

## 3. Anti-Replay-Schutz

- **Redis SETNX**  
  Jeder Token wird beim Einlösen mit `SETNX(jti)` geprüft.  
  Nur der erste Zugriff ist gültig – alle weiteren werden abgelehnt.  
  _Quelle: [DOC:SPEC §6.5]_

---

## 4. Rate-Limits

- **Pro Tenant**: z. B. max. 1000 Stempel/Tag  
- **Pro IP**: z. B. max. 30 Requests/Minute  
- **Pro Card-ID**: z. B. max. 1 Stempel/Minute  
- **Pro Device**: z. B. max. 10 Redeems/Stunde  
Limits werden über Redis + API-Gateway durchgesetzt.  
_Quelle: [DOC:ARCH], [DOC:SPEC §6.6]_

---

## 5. Idempotenz

- **Kritische Pfade sind idempotent**  
  z. B. `/rewards/redeem`, `/stamps/claim`  
  Jeder Request enthält ein `X-Idempotency-Key`, das serverseitig gespeichert und geprüft wird.  
  Wiederholte Requests mit gleichem Key liefern denselben Response.  
  _Quelle: [DOC:SPEC §6.7]_
