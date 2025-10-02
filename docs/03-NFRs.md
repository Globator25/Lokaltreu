# Nicht-funktionale Anforderungen (NFRs) – Lokaltreu

Dieses Dokument beschreibt die verbindlichen technischen Qualitätsziele für das Lokaltreu-System gemäß [DOC:SPEC §9], [DOC:ARCH], [DOC:REQ §6].

---

## 1. Performance-Ziele

- **p50 ≤ 500 ms**  
- **p95 ≤ 3000 ms**  
- **p99 ≤ 6000 ms**  
Diese Werte gelten je Route und werden regelmäßig durch Lasttests überprüft.  
_Quelle: [DOC:SPEC §9], [DOC:ARCH]_

---

## 2. Verfügbarkeit (SLO)

- **99,90 % Verfügbarkeit über 30 Tage**  
Gilt für die Kern-Routen `/stamps/claim` und `/rewards/redeem`.  
_Quelle: [DOC:SPEC §9], [DOC:ARCH]_

---

## 3. Resilienz-Ziele

- **RPO (Recovery Point Objective): 15 Minuten**  
- **RTO (Recovery Time Objective): 60 Minuten**  
Erreicht durch Multi-AZ, Backups, Restore-Protokolle und Canary-Releases.  
_Quelle: [DOC:SPEC §9], [DOC:ARCH]_

---

## 4. PWA-Budgets

- **LCP ≤ 2,5 Sekunden** (Largest Contentful Paint)  
- **INP ≤ 200 ms** (Interaction to Next Paint)  
- **CLS ≤ 0,1** (Cumulative Layout Shift)  
Diese Werte sichern ein schnelles und stabiles Nutzererlebnis auf mobilen Geräten.  
_Quelle: [DOC:SPEC §12], [DOC:ARCH]_

---

## 5. Caching-Strategie

- **stale-while-revalidate** für statische Inhalte  
- **network-first** für API-Aufrufe  
Implementiert über Service Worker in der PWA.  
_Quelle: [DOC:SPEC §12], [DOC:ARCH]_
