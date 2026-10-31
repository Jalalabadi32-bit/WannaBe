# RFC-001: WANNABE Core Architecture & Verification Engine

- **Status**: Accepted
- **Author**: Principal Systems Architect & Security Officer
- **Date**: 2026-11-01
- **Domain**: Software Supply Chain Security / Package-to-Source Verification
- **Target Release**: WANNABE v0.1.0

---

## 1. Executive Summary

Modern software supply chains rely on public registries (e.g., npm) where developers install compiled package tarballs. However, what developers review in open-source git repositories often deviates from what is published. Attackers exploit this gap through:
1. **Uncommitted Lifecycle Scripts**: Malicious `preinstall`, `install`, or `postinstall` hooks added exclusively to the published tarball to achieve remote code execution (RCE) on developer workstations and CI runners.
2. **Stealth Payloads**: Obfuscated or high-entropy JavaScript, base64-encoded binary blobs, or minified scripts lacking source provenance.
3. **Build Artifact Poisoning**: Silent deviations injected into compiled output (`dist/`, `build/`) that do not match the declared TypeScript/ES source.

**WANNABE** solves this problem by executing automated, deterministic, source-to-package verification. This RFC establishes the end-to-end architecture topology, state boundaries, safe sandboxing mechanisms, and AI explanation integration.

---

## 2. Architecture Topology & Component Boundaries

```
                      ┌─────────────────────────────────┐
                      │    Client Layer: CLI / Web UI   │
                      └────────────────┬────────────────┘
                                       │ HTTPS / JSON
                                       ▼
                      ┌─────────────────────────────────┐
                      │    Fastify API Gateway (Node 22) │
                      │  - Rate Limiting (Token Bucket)  │
                      │  - OAuth2/OIDC JWT Auth & RBAC   │
                      │  - Zod Request/Response Validator│
                      └────────────────┬────────────────┘
                                       │ Internal Orchestration
                                       ▼
        ┌─────────────────────────────────────────────────────────────┐
        │                 Verification Engine Core                    │
        │                                                             │
        │  ┌──────────────────────┐        ┌──────────────────────┐   │
        │  │  npm Tarball Fetcher │        │  Git Release Cloner  │   │
        │  └──────────┬───────────┘        └──────────┬───────────┘   │
        │             │                               │               │
        │             ▼                               ▼               │
        │  ┌───────────────────────────────────────────────────────┐  │
        │  │     Zero-Execution Sandbox (Zip-Slip Defense)         │  │
        │  │     - Quota-enforced isolated scratch directories     │  │
        │  │     - Safe extraction with path normalization         │  │
        │  └──────────────────────────┬────────────────────────────┘  │
        │                             │                               │
        │                             ▼                               │
        │  ┌───────────────────────────────────────────────────────┐  │
        │  │        Deterministic Diff & Alignment Engine          │  │
        │  │        - SHA-256 Checksums & File Tree Alignment      │  │
        │  │        - Manifest & Lifecycle Hook Drift Detector     │  │
        │  │        - Source Mapping & Build Output Disambiguation │  │
        │  └──────────────────────────┬────────────────────────────┘  │
        │                             │                               │
        │                             ▼                               │
        │  ┌───────────────────────────────────────────────────────┐  │
        │  │         Deep Code Analyzer (AST & Entropy)            │  │
        │  │         - @babel/parser + @babel/traverse             │  │
        │  │         - Dangerous node detection (eval, exec, env)  │  │
        │  │         - Shannon entropy heuristic scanner           │  │
        │  └──────────────────────────┬────────────────────────────┘  │
        └─────────────────────────────┼───────────────────────────────┘
                                      │ Structured Audit JSON
                                      ▼
                      ┌─────────────────────────────────┐
                      │    AI Explainer Adapter         │
                      │  - Local Ollama (Gemma 4 E4B)   │
                      │  - Deterministic Rule Fallback  │
                      └────────────────┬────────────────┘
                                       │
                                       ▼
                      ┌─────────────────────────────────┐
                      │ Final Scan Report (SARIF / JSON)│
                      └─────────────────────────────────┘
```

---

## 3. Data Flow & Verification Lifecycle State Machine

A verification request transitions through a deterministic, strictly monitored state machine:

```
  ┌───────────┐      ┌────────────┐      ┌──────────────┐      ┌───────────┐
  │  QUEUED   │ ───► │  FETCHING  │ ───► │  EXTRACTING  │ ───► │ ANALYZING │
  └───────────┘      └────────────┘      └──────────────┘      └─────┬─────┘
                                                                     │
  ┌───────────┐      ┌────────────┐      ┌──────────────┐            │
  │  FAILED   │ ◄─── │ COMPLETED  │ ◄─── │ EVALUATING_AI│ ◄──────────┘
  └───────────┘      └────────────┘      └──────────────┘
```

### State Definitions
1. **`QUEUED`**: Scan request validated via Zod schema, assigned a unique UUIDv4, and scheduled for execution.
2. **`FETCHING`**: 
   - Downloads published tarball from `https://registry.npmjs.org/<package>/-/<package>-<version>.tgz`.
   - Resolves target git repository and performs a shallow clone (`--depth 1 --branch <tag>`).
3. **`EXTRACTING`**:
   - Tarball safely decompressed into isolated sandbox with Zip-Slip path checks.
   - Symlinks pointing outside target directory are stripped.
4. **`ANALYZING`**:
   - Computes SHA-256 for all source and package files.
   - Generates unified alignment map (`MATCH`, `MODIFIED`, `ADDED`, `MISSING`, `EXPECTED_BUILD_ARTIFACT`).
   - Audits `package.json` for uncommitted lifecycle scripts (`preinstall`, `install`, `postinstall`).
   - Executes AST analysis on JavaScript/TypeScript files using `@babel/parser` and `@babel/traverse`.
   - Computes Shannon entropy on strings and files to detect obfuscation.
5. **`EVALUATING_AI`**:
   - Compiles structured findings into an audit prompt.
   - Invokes local Gemma 4 E4B via Ollama. If Ollama is unavailable, the deterministic rule-based explainer produces the verdict.
6. **`COMPLETED`**: Scan report persisted and returned to the caller.
7. **`FAILED`**: Handled error state with explicit error diagnostics; sandbox resources are quarantined or cleaned up.

---

## 4. Sandbox Security & Path Traversal (Zip-Slip) Defense

### 4.1 Threat Model for Extraction
Untrusted tarballs can contain:
- Path traversal sequences (`../../etc/passwd` or `package/../../../root/.ssh/authorized_keys`).
- Unbounded file sizes (Decompression Bombs / Zip Bombs).
- Malicious symbolic or hard links targeting sensitive host files.

### 4.2 Sandboxing Invariants
1. **Target Confinement**:
   Every extracted file entry path is resolved against the canonical destination root:
   ```typescript
   const resolvedPath = path.resolve(destDir, entry.path);
   if (!resolvedPath.startsWith(path.resolve(destDir) + path.sep)) {
     throw new SecurityError(`Path traversal attempt detected: ${entry.path}`);
   }
   ```
2. **Size Quotas**:
   - Maximum decompressed size per archive: `500 MB`.
   - Maximum entry count: `20,000 files`.
   - Maximum single file size: `50 MB`.
   Exceeding any threshold immediately aborts the scan with a `QUOTA_EXCEEDED` security flag.
3. **Symlink Neutralization**:
   Symlinks pointing outside the extraction boundary are rejected and quarantined.
4. **Non-Execution Invariant**:
   Under no circumstances does WANNABE execute package code, run `npm install`, or invoke lifecycle scripts. Extraction and analysis are strictly static.

---

## 5. Deep AST Analysis & Anomaly Detection Heuristics

The engine uses `@babel/parser` configured with TypeScript, JSX, and modern ECMAScript plugins. The `@babel/traverse` visitor inspects for high-risk AST patterns:

| AST Pattern | Node Signature | Severity | Risk Explanation |
|---|---|---|---|
| Dynamic Code Execution | `CallExpression` calling `Identifier('eval')` or `Identifier('Function')` | CRITICAL | Dynamic code evaluation often indicates packed, obfuscated, or downloaded secondary payloads. |
| Process Execution | `CallExpression` referencing `child_process.exec`, `child_process.spawn`, `child_process.execSync` | HIGH | Shell command execution inside package files or lifecycle scripts. |
| Sensitive Env Exfiltration | `MemberExpression` accessing `process.env.NPM_TOKEN`, `process.env.GITHUB_TOKEN`, `process.env.AWS_SECRET_ACCESS_KEY` | CRITICAL | Harvesting credentials during package initialization or execution. |
| Raw Sockets & Network | `CallExpression` referencing `net.connect`, `tls.connect`, `dgram.createSocket`, raw `http.request` in unexpected locations | HIGH | Out-of-band communication or command-and-control beacons. |
| Obfuscated Hex / Base64 | String literals exceeding length 128 with Shannon entropy > 4.5 | MEDIUM | Obfuscated payloads hidden in minified or benign-looking scripts. |

---

## 6. Design Decisions, Trade-Offs & Failure Modes

### Decision 1: Node.js 22 + Fastify + TypeScript Monorepo
- **Trade-off**: Requires Node.js runtime instead of a single compiled Go/Rust binary.
- **Justification**: npm and JavaScript/TypeScript ecosystems natively support `@babel/parser`, `tar`, and `pacote`. Shared TypeScript types across CLI, Fastify API, Core Engine, and React frontend eliminate data serialization drift.
- **Failure Mode**: Node.js memory pressure on very large tarballs (>200MB).
  - *Mitigation*: Stream processing for tarball extraction and hash calculation; memory limits enforced per scan worker.

### Decision 2: Isolated Sandbox Scratch Workspaces
- **Trade-off**: Disk I/O overhead on temporary directory creation and cleanup.
- **Justification**: Guarantees strict isolation between concurrent scans, prevents cross-scan contamination, and ensures Zip-Slip attacks are trapped in an ephemeral folder.
- **Failure Mode**: Disk exhaustion from abandoned scan workspaces.
  - *Mitigation*: Automated `finally` cleanup blocks and a background sweeper removing workspaces older than 1 hour.

### Decision 3: Local Ollama / Gemma AI with Deterministic Heuristic Fallback
- **Trade-off**: Local LLM requires GPU or CPU inference capacity and may experience latency (2-10s).
- **Justification**: Keeps proprietary audit data 100% private and offline-capable without relying on third-party cloud APIs.
- **Failure Mode**: Ollama daemon is offline or GPU driver is unavailable.
  - *Mitigation*: The `IAIExplainer` adapter detects connectivity failure within 500ms and switches immediately to the deterministic rule-based explainer. The report clearly attributes the verdict source (`gemma-4-e4b` vs `deterministic-heuristic-engine`).
