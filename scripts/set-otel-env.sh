#!/usr/bin/env bash

# Sets OpenTelemetry OTLP environment variables for the current shell session
# and optionally persists them into your shell rc file (~/.bashrc, ~/.zshrc, or ~/.profile).
#
# Usage (session only; recommended to source):
#   source scripts/set-otel-env.sh
#   . scripts/set-otel-env.sh
#
# Persist for future shells (appends a managed block to rc file):
#   scripts/set-otel-env.sh --persist
#   scripts/set-otel-env.sh --persist --rc ~/.zshrc
#
# Remove from session or rc:
#   scripts/set-otel-env.sh --remove                # session only
#   scripts/set-otel-env.sh --remove --persist      # also remove managed block from rc
#
set -euo pipefail

ENDPOINT="https://otel-collector.example:4318"
PROTOCOL="http/protobuf"
SERVICE_NAME="lokaltreu"
SERVICE_VERSION="dev"
DEPLOYMENT_ENVIRONMENT="dev"
LOGS_EXPORTER="otlp"
TRACES_EXPORTER="otlp"
METRICS_EXPORTER="otlp"
PERSIST=false
REMOVE=false
RC_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --endpoint) ENDPOINT="$2"; shift 2;;
    --protocol) PROTOCOL="$2"; shift 2;;
    --service-name) SERVICE_NAME="$2"; shift 2;;
    --service-version) SERVICE_VERSION="$2"; shift 2;;
    --env) DEPLOYMENT_ENVIRONMENT="$2"; shift 2;;
    --logs-exporter) LOGS_EXPORTER="$2"; shift 2;;
    --traces-exporter) TRACES_EXPORTER="$2"; shift 2;;
    --metrics-exporter) METRICS_EXPORTER="$2"; shift 2;;
    --persist) PERSIST=true; shift;;
    --remove) REMOVE=true; shift;;
    --rc) RC_FILE="$2"; shift 2;;
    -h|--help)
      sed -n '1,120p' "$0" | sed 's/^# \{0,1\}//'; exit 0;;
    *) echo "Unknown arg: $1"; exit 1;;
  esac
done

detect_rc_file() {
  if [[ -n "$RC_FILE" ]]; then
    echo "$RC_FILE"; return 0
  fi
  case "${SHELL:-}" in
    *zsh) echo "$HOME/.zshrc";;
    *bash) echo "$HOME/.bashrc";;
    *) echo "$HOME/.profile";;
  esac
}

RESOURCE_ATTR="service.name=${SERVICE_NAME},service.version=${SERVICE_VERSION},deployment.environment=${DEPLOYMENT_ENVIRONMENT}"

export_session() {
  if $REMOVE; then
    unset OTEL_EXPORTER_OTLP_ENDPOINT || true
    unset OTEL_EXPORTER_OTLP_PROTOCOL || true
    unset OTEL_RESOURCE_ATTRIBUTES || true
    unset OTEL_LOGS_EXPORTER || true
    unset OTEL_TRACES_EXPORTER || true
    unset OTEL_METRICS_EXPORTER || true
  else
    export OTEL_EXPORTER_OTLP_ENDPOINT="$ENDPOINT"
    export OTEL_EXPORTER_OTLP_PROTOCOL="$PROTOCOL"
    export OTEL_RESOURCE_ATTRIBUTES="$RESOURCE_ATTR"
    export OTEL_LOGS_EXPORTER="$LOGS_EXPORTER"
    export OTEL_TRACES_EXPORTER="$TRACES_EXPORTER"
    export OTEL_METRICS_EXPORTER="$METRICS_EXPORTER"
  fi
}

persist_block() {
  local rc
  rc="$(detect_rc_file)"
  mkdir -p "$(dirname "$rc")"
  touch "$rc"
  local tmp
  tmp="${rc}.lokaltreu.$$"
  # Remove existing managed block
  awk 'BEGIN{skip=0} />>> lokaltreu-otel start/{skip=1; next} /<<< lokaltreu-otel end/{skip=0; next} skip==0{print}' "$rc" > "$tmp"
  if $REMOVE; then
    mv "$tmp" "$rc"
    echo "Removed persisted OTEL block from $rc"
    return 0
  fi
  {
    cat "$tmp"
    echo "# >>> lokaltreu-otel start"
    echo "# Managed by scripts/set-otel-env.sh"
    echo "export OTEL_EXPORTER_OTLP_ENDPOINT=\"$ENDPOINT\""
    echo "export OTEL_EXPORTER_OTLP_PROTOCOL=\"$PROTOCOL\""
    echo "export OTEL_RESOURCE_ATTRIBUTES=\"$RESOURCE_ATTR\""
    echo "export OTEL_LOGS_EXPORTER=\"$LOGS_EXPORTER\""
    echo "export OTEL_TRACES_EXPORTER=\"$TRACES_EXPORTER\""
    echo "export OTEL_METRICS_EXPORTER=\"$METRICS_EXPORTER\""
    echo "# <<< lokaltreu-otel end"
  } > "$rc"
  rm -f "$tmp"
  echo "Persisted OTEL env to $rc (open a new shell to load)."
}

export_session

if $PERSIST; then
  persist_block
fi

# Helpful warnings if common port/protocol mismatch
if [[ "$PROTOCOL" == "grpc" && "$ENDPOINT" == *":4318"* ]]; then
  echo "[warn] grpc typically uses port 4317; you set $ENDPOINT" >&2
fi
if [[ "$PROTOCOL" == "http/protobuf" && "$ENDPOINT" == *":4317"* ]]; then
  echo "[warn] http/protobuf typically uses port 4318; you set $ENDPOINT" >&2
fi

# If not sourced, changes won't affect parent shell. Try to detect.
if [[ "${BASH_SOURCE-}" != "" && "${BASH_SOURCE[0]-}" == "$0" ]]; then
  echo "Note: to affect your current shell session, source this script:"
  echo "  source scripts/set-otel-env.sh"
fi

echo "Session OTEL env status:"
env | grep -E '^OTEL_' || true

