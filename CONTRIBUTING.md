Developer-Checkliste

- H1 vorhanden.
- Verzeichnisbaum als Codeblock.
- Quickstart-Block vorhanden und getestet.
- CI-Gates in `.github/workflows` vorhanden.

Typische Stolpersteine & Erste Hilfe

- Wenn Markdown unten „weiterläuft": prüfe schließende Backticks (```).
- Wenn der Baum inline erscheint: stelle sicher, dass der Codeblock mit ``` geöffnet und geschlossen ist.

Hinweise

> Hinweis: Keine Secrets im Repo. `.env*` und Terraform-States sind in `.gitignore`. SOPS-verschlüsselte Dateien dürfen versioniert werden.

Contribution workflow (kurz)

1. Fork oder branch vom `main`/`master`.
2. Commit nach konventionellem Style (z. B. "docs: ...", "fix: ...").
3. Öffne PR, verlinke relevante Issues und CI-Checklist.
4. CI muss grün sein (Lint, Tests, Coverage) bevor Merge.
