#!/bin/bash
set -u

# ─── WANNABE Production Deployment Pre-flight Validator ──────────────────
# Verifies system readiness, security secrets, ports, and hardware specs.

PASSED=0
FAILED=0
WARNED=0

echo "=========================================================="
echo "    WANNABE Production Pre-flight Readiness Check         "
echo "=========================================================="

check_pass() {
  echo "  ✅ PASS: $1"
  PASSED=$((PASSED + 1))
}

check_fail() {
  echo "  ❌ FAIL: $1"
  FAILED=$((FAILED + 1))
}

check_warn() {
  echo "  ⚠️  WARN: $1"
  WARNED=$((WARNED + 1))
}

# 1. Docker Check
echo ""
echo "[1] Checking Container Runtime..."
if command -v docker >/dev/null 2>&1; then
  check_pass "Docker binary detected ($(docker --version 2>/dev/null | head -1))"
else
  check_fail "Docker is not installed. Install Docker Engine: https://docs.docker.com/engine/install/"
fi

if docker compose version >/dev/null 2>&1; then
  check_pass "Docker Compose v2 plugin detected"
else
  check_fail "Docker Compose v2 is missing. Install docker-compose-plugin."
fi

# 2. Environment & Secrets Check
echo ""
echo "[2] Validating Production Secrets & Config (.env)..."
if [ ! -f .env ]; then
  check_fail ".env file not found. Copy .env.production.example to .env and configure secrets."
else
  check_pass ".env file exists"

  # Check for insecure defaults
  if grep -q "replace-with" .env; then
    check_fail ".env contains placeholder strings ('replace-with*'). Generate strong secrets using 'openssl rand -hex 32'."
  else
    check_pass "No placeholder strings found in .env"
  fi

  if grep -E "^(JWT_SECRET=wannabe-dev|WANNABE_API_KEY=wannabe-dev)" .env >/dev/null 2>&1; then
    check_fail "Insecure default development keys found in .env! Production will refuse to start."
  else
    check_pass "Strong custom secrets detected in .env"
  fi

  if grep -q "^DOMAIN_NAME=scanner.example.com" .env; then
    check_warn "DOMAIN_NAME is set to the example domain 'scanner.example.com'. Update to your actual domain."
  else
    check_pass "Custom DOMAIN_NAME configured"
  fi
fi

# 3. Ports Availability Check (80, 443)
echo ""
echo "[3] Checking Ingress Ports Availability..."
for PORT in 80 443; do
  if command -v ss >/dev/null 2>&1; then
    if ss -tuln | grep -q ":$PORT "; then
      check_warn "Port $PORT appears to be in use already. Ensure existing web servers (e.g. Apache/Nginx) are stopped or mapped."
    else
      check_pass "Port $PORT is free"
    fi
  elif command -v netstat >/dev/null 2>&1; then
    if netstat -tuln | grep -q ":$PORT "; then
      check_warn "Port $PORT appears to be in use already."
    else
      check_pass "Port $PORT is free"
    fi
  else
    check_warn "Neither ss nor netstat found; cannot verify port $PORT availability automatically."
  fi
done

# 4. Hardware Resources Check
echo ""
echo "[4] Checking System Resources..."
if [ -f /proc/meminfo ]; then
  TOTAL_MEM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
  TOTAL_MEM_GB=$((TOTAL_MEM_KB / 1024 / 1024))
  if [ "$TOTAL_MEM_GB" -ge 8 ]; then
    check_pass "Sufficient system RAM detected: ~${TOTAL_MEM_GB} GB"
  elif [ "$TOTAL_MEM_GB" -ge 4 ]; then
    check_warn "RAM is ~${TOTAL_MEM_GB} GB. Recommended is 8+ GB for smooth Ollama local LLM inference."
  else
    check_fail "Low RAM detected: ~${TOTAL_MEM_GB} GB. Minimum 4 GB required."
  fi
fi

# Check free disk space in current partition
FREE_DISK_GB=$(df -BG . | awk 'NR==2 {print $4}' | tr -d 'G')
if [ -n "$FREE_DISK_GB" ]; then
  if [ "$FREE_DISK_GB" -ge 10 ]; then
    check_pass "Sufficient disk space available: ~${FREE_DISK_GB} GB free"
  else
    check_warn "Low disk space: ~${FREE_DISK_GB} GB free. At least 10 GB is recommended for Docker layers & Ollama models."
  fi
fi

echo ""
echo "=========================================================="
echo "Summary: $PASSED passed, $WARNED warnings, $FAILED failures."
if [ "$FAILED" -eq 0 ]; then
  echo "🚀 System is ready for public deployment!"
  echo "   Start stack: docker compose -f docker-compose.prod.yml up -d --build"
  echo "   Setup SSL:   ./deploy/init-ssl.sh"
  exit 0
else
  echo "🛑 Resolve the failures above before deploying publicly."
  exit 1
fi
