# WANNABE

**Trust the Source. Verify the Package.**
*Automated Software Supply Chain Security and Source-to-Package Verification Engine*

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Hacktoberfest HackDay](https://img.shields.io/badge/Hacktoberfest-HackDay%20Sonipat-orange.svg)](HACKATHON.md)
[![Problem Statement](https://img.shields.io/badge/Problem%20Statement-PS%204-purple.svg)](HACKATHON.md)
[![Tests](https://img.shields.io/badge/Tests-84%20passing-brightgreen.svg)](#testing)

---

## The problem

A published npm package is not always what you reviewed on GitHub. Attackers inject malicious
`postinstall` scripts, obfuscated payloads, and backdoored binaries **only into the tarball** — the
diff never appears in the source repository.

WANNABE answers one question: **does the published package actually match its claimed source?**

For the full threat model, architecture rationale, and hackathon proposal, see [HACKATHON.md](HACKATHON.md).

---

## How it works

```
GitHub source tag  ──┐
                     ├──► Verification Engine ──► Gemma AI Analyst ──► Dashboard
npm tarball        ──┘
```

1. Fetch the exact npm tarball and check out the matching GitHub release tag
2. Compare file trees with SHA-256 hashes — find added, modified, and missing files
3. Run AST analysis and Shannon entropy detection on all JS/TS files
4. Diff `package.json` lifecycle scripts for uncommitted hooks
5. Gemma (local, via Ollama) explains findings in plain English and produces a risk verdict
6. Interactive dashboard renders the full evidence tree with file-level diffs

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 22.x | `node --version` |
| npm | 10.x | comes with Node 22 |
| Git | any | must be on `PATH` |
| Ollama | latest | [ollama.com/download](https://ollama.com/download) — optional, rule-based fallback is active without it |

Pull the AI model (optional but recommended):

```bash
ollama pull gemma3:4b
# Fallback: ollama pull gemma2:2b
```

---

## Setup

```bash
# 1. Clone
git clone https://github.com/Jalalabadi32-bit/WannaBe.git
cd WannaBe

# 2. Install all workspace dependencies
npm ci

# 3. Type-check all 5 packages
npm run typecheck

# 4. Run the full test suite
npm test
```

Expected output:

```
Test Files  14 passed (14)
     Tests  84 passed (84)
```

---

## Running locally

### Option A — Docker Compose (recommended)

Starts the Fastify API on port 3000 and the Vite frontend on port 5173:

```bash
docker compose up
```

Open [http://localhost:5173](http://localhost:5173).

### Option B — manual dev servers

Terminal 1 — API:

```bash
cd packages/api
npx ts-node --esm src/index.ts
# Listening on http://localhost:3000
```

Terminal 2 — Frontend:

```bash
cd packages/frontend
npm run dev
# Vite dev server at http://localhost:5173
```

## Public Deployment

### Option A — 100% Free Cloud Tier (Vercel + Render)

Deploy at zero cost using cloud free tiers:
- **Frontend**: [Vercel Hobby](https://vercel.com) via [`vercel.json`](vercel.json)
- **API**: [Render Free](https://render.com) via 1-click [`render.yaml`](render.yaml) Blueprint
- **AI**: Built-in deterministic security heuristic engine (0ms latency, zero GPU/RAM overhead)
- **Cache**: In-memory with no database required

See the [Free-Tier Deployment Guide](docs/FREE_TIER_DEPLOYMENT.md) for 5-minute setup instructions.

### Option B — Self-Hosted Docker (VPS / Cloud VM)

Hardened self-hosted deployment with automated TLS (Let's Encrypt / Certbot), Nginx reverse proxying, rate limiting, and zero exposed backend ports.

```bash
# 1. Copy production environment template and generate random secrets
cp .env.production.example .env

# 2. Run pre-flight check
bash deploy/validate-prod.sh

# 3. Start production containers
docker compose -f docker-compose.prod.yml up -d --build

# 4. Provision Let's Encrypt SSL certificate
bash deploy/init-ssl.sh
```

For complete cloud VPS setup, firewall configuration, DNS setup, and maintenance guides, see the [Production Deployment Guide](docs/DEPLOYMENT.md).

---

## CLI usage

```bash
# Health check (Ollama + sandbox filesystem)
npx wannabe health

# Verify a package against its source
npx wannabe verify lodash 4.17.21 \
  --repo https://github.com/lodash/lodash \
  --tag 4.17.21

# Output as JSON
npx wannabe verify lodash 4.17.21 --repo ... --format json

# Output as SARIF (for IDE integrations)
npx wannabe verify lodash 4.17.21 --repo ... --format sarif
```

---

## Architecture

```
packages/
  shared/       @wannabe/shared   Zod schemas, TypeScript types, risk models
  core/         @wannabe/core     Sandbox, fetchers, comparator, analyzers, AI, cache, circuit breakers
  api/          @wannabe/api      Fastify REST API + SSE scan progress stream
  cli/          @wannabe/cli      Commander CLI, SARIF/table/JSON formatters
  frontend/     @wannabe/frontend React 18 + Vite + Tailwind dashboard
```

The monorepo uses npm workspaces. All packages are strictly typed with TypeScript 5.4 project references.

### Key API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/scans` | Start a verification scan |
| `GET` | `/api/v1/scans/:id` | Poll scan status |
| `GET` | `/api/v1/scans/:id/stream` | SSE real-time progress stream |
| `GET` | `/api/v1/scans/:id/report` | Full ScanReport (completed scans only) |
| `GET` | `/readyz` | Readiness probe |
| `GET` | `/metrics` | Prometheus metrics |

---

## Testing

```bash
# Unit and component tests (84 tests, no network required)
npm test

# End-to-end integration test (requires network + git)
RUN_E2E=1 npx vitest run packages/api/tests/e2e.test.ts --reporter=verbose
```

The E2E test runs the full pipeline against `lodash@4.17.21` — a small, clean, public package — and
asserts the scan completes with a valid report and zero critical flags.

---

## Team

- **Armaan Middha**
- **Ishan Singh**

Hacktoberfest HackDay — Sonipat (NST, Rishihood University)

---

## License

[MIT](LICENSE)
