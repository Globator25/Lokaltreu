#!/usr/bin/env bash
set -euo pipefail

# This script configures branch protection for 'main' according to governance requirements.

BRANCH="${BRANCH:-main}"
REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

echo "Configuring branch protection for $REPO:$BRANCH ..."

# Required status checks
REQUIRED_CHECKS=("ci" "security-gates" "gdpr-compliance")

# Apply protection via GitHub CLI
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/$REPO/branches/$BRANCH/protection" \
  -f required_status_checks.strict=true \
  -f required_status_checks.contexts[]="ci" \
  -f required_status_checks.contexts[]="security-gates" \
  -f required_status_checks.contexts[]="gdpr-compliance" \
  -f enforce_admins=true \
  -f required_pull_request_reviews.dismiss_stale_reviews=true \
  -f required_pull_request_reviews.required_approving_review_count=2 \
  -f required_pull_request_reviews.require_code_owner_reviews=true \
  -f restrictions=null \
  -f allow_force_pushes=false \
  -f allow_deletions=false

echo "Branch protection applied successfully."

# Usage:
#   chmod +x scripts/configure_branch_protection.sh
#   ./scripts/configure_branch_protection.sh
