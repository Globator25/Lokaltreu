#!/usr/bin/env bash
set -euo pipefail

# Config
REPO="${REPO:-origin}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"
TAG="v0.4.0"
TITLE="v0.4.0 – Governance & CI-Gates"
NOTES_FILE="${NOTES_FILE:-docs/releases/v0.4.0.md}"

# Optional artifacts (space-separated paths). Example:
# ARTIFACTS="reports/openapi/spectral-report.txt reports/contract/results.json"
ARTIFACTS="${ARTIFACTS:-}"

# Pre-flight
command -v gh >/dev/null || { echo "gh CLI required. Install and auth with 'gh auth login'."; exit 1; }
git rev-parse --is-inside-work-tree >/dev/null

# Sync and tag
git switch "$MAIN_BRANCH"
git pull "$REPO" "$MAIN_BRANCH"

# Create annotated tag if not existing
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists, skipping tag creation."
else
  git tag -a "$TAG" -m "Step 4: Governance & CI Gates complete"
  git push "$REPO" "$TAG"
fi

# Create or update GitHub release
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "Release $TAG exists. Updating notes and assets…"
  gh release edit "$TAG" --title "$TITLE" --notes-file "$NOTES_FILE"
else
  echo "Creating release $TAG…"
  gh release create "$TAG" --title "$TITLE" --notes-file "$NOTES_FILE" --verify-tag
fi

# Upload optional artifacts if provided
if [[ -n "$ARTIFACTS" ]]; then
  # shellcheck disable=SC2086
  gh release upload "$TAG" $ARTIFACTS --clobber
fi

echo "Release $TAG published."

# Usage:
#   chmod +x scripts/release_v0.4.0.sh
#   NOTES_FILE=docs/releases/v0.4.0.md ARTIFACTS="reports/openapi/spectral.txt" ./scripts/release_v0.4.0.sh
