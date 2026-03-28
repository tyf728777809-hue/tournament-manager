#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-dry-run}"
PAYLOAD_FILE="${2:-tmp/feishu-interactive-confirm.json}"
PORT="${FEISHU_CALLBACK_PORT:-8787}"
PATHNAME="${FEISHU_CALLBACK_PATH:-/feishu/callback}"

if [[ ! -f "$PAYLOAD_FILE" ]]; then
  echo "[error] payload file not found: $PAYLOAD_FILE" >&2
  exit 1
fi

if [[ -z "${FEISHU_VERIFICATION_TOKEN:-}" ]]; then
  echo "[error] FEISHU_VERIFICATION_TOKEN is required" >&2
  exit 1
fi

if [[ "$MODE" == "real" && -z "${FEISHU_ACCESS_TOKEN:-}" ]]; then
  echo "[error] FEISHU_ACCESS_TOKEN is required for real mode" >&2
  exit 1
fi

SERVER_LOG="/tmp/feishu-callback-server-${MODE}.log"
SERVER_PID_FILE="/tmp/feishu-callback-server-${MODE}.pid"

cleanup() {
  if [[ -f "$SERVER_PID_FILE" ]]; then
    kill "$(cat "$SERVER_PID_FILE")" >/dev/null 2>&1 || true
    rm -f "$SERVER_PID_FILE"
  fi
}
trap cleanup EXIT

export FEISHU_CALLBACK_PORT="$PORT"
export FEISHU_CALLBACK_PATH="$PATHNAME"

if [[ "$MODE" == "dry-run" ]]; then
  export FEISHU_CALLBACK_DRY_RUN=1
else
  unset FEISHU_CALLBACK_DRY_RUN || true
fi

node "炉石赛事/feishu-callback-server.js" > "$SERVER_LOG" 2>&1 &
echo $! > "$SERVER_PID_FILE"
sleep 1

echo "--- request"
curl -s -X POST "http://127.0.0.1:${PORT}${PATHNAME}" \
  -H 'Content-Type: application/json' \
  --data @"$PAYLOAD_FILE"

echo ""
echo "--- server log"
sed -n '1,160p' "$SERVER_LOG"
