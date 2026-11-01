#!/bin/sh
set -e

if [ "${WANNABE_SKIP_MODEL_PULL:-0}" = "1" ]; then
  echo "[wannabe:init] Skipping model pull (WANNABE_SKIP_MODEL_PULL=1)"
  exit 0
fi

OLLAMA_HOST="${OLLAMA_HOST:-http://ollama:11434}"
MODEL="${WANNABE_MODEL:-gemma3:4b}"

echo "[wannabe:init] Waiting for Ollama at $OLLAMA_HOST..."

# Wait up to 120s for Ollama to respond
for i in $(seq 1 60); do
  if wget -qO- "$OLLAMA_HOST/api/tags" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Check if model already exists
if wget -qO- "$OLLAMA_HOST/api/tags" 2>/dev/null | grep -q "\"$MODEL\""; then
  echo "[wannabe:init] Model $MODEL already available, skipping pull"
  exit 0
fi

echo "[wannabe:init] Pulling model $MODEL (this may take a few minutes)..."
wget --post-data="{\"name\":\"$MODEL\"}" \
     --header="Content-Type: application/json" \
     -qO- "$OLLAMA_HOST/api/pull" | while IFS= read -r line; do
  status=$(echo "$line" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  [ -n "$status" ] && echo "[wannabe:init] $status"
done

echo "[wannabe:init] Model $MODEL ready"
