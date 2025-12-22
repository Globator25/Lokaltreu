#!/usr/bin/env python3
"""
Bereinigt Legacy- oder doppelt vorhandene Artefakte im Lokaltreu-Repo.

- Standardmäßig Dry-Run: es wird nur angezeigt, was gelöscht würde.
- Mit --force werden die Dateien/Ordner tatsächlich entfernt.
- Kritische Pfade (CI/Governance/Terraform/Compliance) sind hardcodiert geschützt.
"""

from __future__ import annotations

import argparse
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Target:
    path: Path
    reason: str
    risk: str

    @property
    def is_dir(self) -> bool:
        return self.path.is_dir()


PROTECTED_PREFIXES = [
    ".git",
    ".github",
    "infra/terraform",
    "compliance",
    "docs",
    "openapi",
    "AGENTS.md",
    "package.json",
    "package-lock.json",
    "tsconfig",
    "jest.config",
]


def is_protected(path: Path) -> bool:
    rel = path.as_posix()
    for prefix in PROTECTED_PREFIXES:
        if rel == prefix or rel.startswith(prefix.rstrip("/") + "/"):
            return True
    return False


TARGETS: list[Target] = [
    Target(Path("apps/web/next.config.js"), "Legacy Next.js-Config (JS) – TS-Version vorhanden", "niedrig"),
    Target(Path("apps/api/vitest.config.js"), "Transpiliertes Duplikat von vitest.config.ts", "niedrig"),
    Target(Path("apps/api/vitest.config.d.ts"), "Type-Definition-Artefakt; driftet gegenüber .ts", "niedrig"),
    Target(Path("packages/config"), "Verwaistes Legacy-Package ohne package.json (nur dist)", "mittel"),
]


def iter_files(target: Target) -> Iterable[Path]:
    full_path = REPO_ROOT / target.path
    if not full_path.exists():
        return []
    if full_path.is_dir():
        for entry in full_path.rglob("*"):
            if entry.is_file():
                yield entry
    else:
        yield full_path


def delete_target(target: Target) -> int:
    full_path = REPO_ROOT / target.path
    if not full_path.exists():
        return 0
    if full_path.is_file():
        full_path.unlink()
        return 1
    shutil.rmtree(full_path)
    return 1


def format_size(num_bytes: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    size = float(num_bytes)
    for unit in units:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def main() -> None:
    parser = argparse.ArgumentParser(description="Bereinigt Legacy-Dateien (Dry-Run default).")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Dateien/Ordner wirklich löschen (ansonsten nur Dry-Run).",
    )
    args = parser.parse_args()

    total_size = 0
    pending: list[Target] = []

    for target in TARGETS:
        full_path = REPO_ROOT / target.path
        if not full_path.exists():
            continue
        if is_protected(target.path):
            print(f"[SKIP] {target.path} ist geschützt und wird nicht gelöscht.")
            continue

        files = list(iter_files(target))
        size = sum(p.stat().st_size for p in files)
        total_size += size
        pending.append(target)

        action = "Würde löschen" if not args.force else "Lösche"
        print(f"{action}: {target.path} ({target.reason}, Risiko: {target.risk})")

        if not args.force:
            continue

        deleted = delete_target(target)
        print(f"  → Entfernt ({deleted} Eintrag{'e' if deleted != 1 else ''})")

    if args.force:
        print(f"\nZusammenfassung: {len(pending)} Target(s) entfernt, freigegebener Speicher ~ {format_size(total_size)}.")
    else:
        print(
            f"\nDry-Run abgeschlossen: {len(pending)} Target(s) würden entfernt "
            f"werden, geschätzter Speichergewinn ~ {format_size(total_size)}."
        )


if __name__ == "__main__":
    main()
