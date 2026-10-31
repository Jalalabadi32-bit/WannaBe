# WANNABE Supply Chain Verification Engine — STRIDE Threat Model

## 1. Executive Summary & Purpose

WANNABE is designed to verify whether an npm package published to a registry accurately matches its declared source code in a GitHub repository. Because WANNABE ingests untrusted code archives from public registries, the engine operates as a potential target for malicious actors attempting sandbox escapes, remote code execution, denial of service, and audit tampering.

This threat model uses the **STRIDE** methodology (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) to identify threat vectors across all verification lifecycle phases and document concrete architectural mitigations.

---

## 2. Architecture & Trust Boundaries

```
[ Public Internet ]
       │
       ▼ (Boundary 1: Ingestion)
┌─────────────────────────────────────────────────────────────┐
│ Retrieval Layer (NpmFetcher, GitFetcher, Circuit Breakers)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ (Boundary 2: Extraction Sandbox)
┌─────────────────────────────────────────────────────────────┐
│ Zero-Execution Sandbox (Tarball Unpack, Path Validation)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ (Boundary 3: Static Analysis Engine)
┌─────────────────────────────────────────────────────────────┐
│ AST Analyzer, Shannon Entropy Scanner, Tree Comparator      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ (Boundary 4: AI Inference & Reporting)
┌─────────────────────────────────────────────────────────────┐
│ Hybrid AI Explainer (Local Gemma via Ollama, API Gateway)   │
└─────────────────────────────────────────────────────────────┘
```

### Trust Boundary Analysis
- **Boundary 1 (External Ingestion)**: Ingestion of untrusted tarballs and git archive streams from external third-party endpoints (npm registry, GitHub API).
- **Boundary 2 (Filesystem Sandbox)**: Decompression of arbitrary archive entries onto local staging directories. Untrusted filenames, symlinks, and payload sizes.
- **Boundary 3 (Static Code Analysis)**: Parsing untrusted JavaScript/TypeScript files into Abstract Syntax Trees (ASTs) without executing any code.
- **Boundary 4 (Inference & Client Consumption)**: Ingesting security flags into LLM prompts; returning verification audit reports via Fastify REST API.

---

## 3. Asset Classification

| Asset | Sensitivity | Impact of Compromise |
|---|---|---|
| **Host System & Infrastructure** | Critical | Host compromise, container escape, lateral network access |
| **API Authentication Credentials** | Critical | Unauthorized scan execution, privilege escalation to admin |
| **GitHub Personal Access Tokens** | High | Rate limit abuse, unintended repository access |
| **Verification Reports & Diff Hashes** | High | Integrity loss, false negative security clearances |
| **Local LLM Runtime (Ollama)** | Medium | Denial of service, model poisoning, prompt injection |

---

## 4. STRIDE Threat Analysis

### 4.1 Spoofing (Identity & Authenticity)

| Threat ID | Threat Description | Attack Vector | Mitigation Status | Technical Countermeasure |
|---|---|---|---|---|
| **S-01** | Package typosquatting / author spoofing | Attacker publishes a malicious package under a lookalike name or points to an unrelated git repo. | **Mitigated** | WANNABE compares npm metadata against the git repository and checks git commit tags and release signatures. |
| **S-02** | API client impersonation | Unauthorized client submits verification scans or accesses reports without valid credentials. | **Mitigated** | Dual authentication via signed JWTs (`@fastify/jwt`) and pre-shared API keys (`x-api-key`). RBAC enforces `analyst` or `admin` roles for scan initiation. |
| **S-03** | Git tag / commit spoofing | Attacker pushes an unreleased or lightweight git tag to mimic an official release. | **Mitigated** | Strict git tag resolution via GitHub Releases/Tags API; validates tag against version semantics (`v<version>`). |

### 4.2 Tampering (Data Integrity)

| Threat ID | Threat Description | Attack Vector | Mitigation Status | Technical Countermeasure |
|---|---|---|---|---|
| **T-01** | Zip-Slip path traversal during extraction | Malicious tarball contains entry paths with `../` or absolute paths (`/etc/passwd`) targeting host files. | **Mitigated** | `SandboxManager` canonicalizes and resolves every archive entry path using `path.resolve` and verifies it starts strictly within the isolated workspace boundary. Throws `SecurityError` on traversal. |
| **T-02** | Symlink / Hardlink directory escapes | Tarball contains symlinks pointing outside the sandbox destination folder. | **Mitigated** | Symlink extraction is disabled by default (`allowSymlinks: false`). Any link targeting external paths triggers extraction failure. |
| **T-03** | Injected package lifecycle scripts | Attacker adds `preinstall`, `install`, or `postinstall` commands to published `package.json` that do not exist in source repository. | **Mitigated** | `GhostCodeComparator` diffs manifest files directly and flags uncommitted lifecycle hooks with `critical` severity (`WANNABE-R001`). |
| **T-04** | Hidden code modifications in build artifacts | Attacker subtly modifies transpiled JavaScript in `dist/` to inject malware while keeping source clean. | **Mitigated** | AST semantic analysis compares syntactic structures; Shannon entropy scanner identifies packed and obfuscated strings. |

### 4.3 Repudiation (Auditability)

| Threat ID | Threat Description | Attack Vector | Mitigation Status | Technical Countermeasure |
|---|---|---|---|---|
| **R-01** | Disputing verification report integrity | Package author denies findings or claims verified tarball differed from published artifact. | **Mitigated** | Immutable scan reports keyed by UUID; SHA-256 cryptographic hashes computed for all individual source and package files. |
| **R-02** | Audit trail loss | Failure to record which user or CI key initiated a scan. | **Mitigated** | API middleware binds authenticated user identity (`id`, `username`, `role`) to each scan lifecycle event. |

### 4.4 Information Disclosure (Confidentiality)

| Threat ID | Threat Description | Attack Vector | Mitigation Status | Technical Countermeasure |
|---|---|---|---|---|
| **I-01** | Environment secret leakage | Malicious package attempts to read host environment variables or sensitive files during analysis. | **Mitigated** | **Zero-Execution Sandbox**: downloaded package code is never executed. Files are analyzed strictly via static AST parsing (`@babel/parser`) and string entropy calculation. |
| **I-02** | Token exposure in logs or telemetry | `GITHUB_TOKEN` or `WANNABE_API_KEY` printed in CLI verbose output or Prometheus metrics. | **Mitigated** | Sensitive tokens are sanitized from diagnostic log streams and excluded from Prometheus metric labels. |

### 4.5 Denial of Service (Availability)

| Threat ID | Threat Description | Attack Vector | Mitigation Status | Technical Countermeasure |
|---|---|---|---|---|
| **D-01** | Tarball decompression bomb | Attacker submits a tiny compressed tarball that expands to tens of gigabytes or millions of small files. | **Mitigated** | `SandboxManager` enforces hard quotas: `maxDecompressedBytes` (default 200MB) and `maxEntryCount` (default 10,000 entries). Exceeding quota immediately aborts extraction. |
| **D-02** | Upstream registry starvation / outages | Slow or failing npm/GitHub responses cause request pileups and thread exhaustion. | **Mitigated** | Circuit breakers (`opossum`) wrap npm and GitHub requests. Fast-fails after consecutive timeouts to prevent socket exhaustion. |
| **D-03** | Ollama inference resource exhaustion | High volume of scan requests overwhelms local GPU/CPU inference memory. | **Mitigated** | Ollama circuit breaker with 3s timeout and immediate fallback to deterministic heuristic security explanation engine. Rate limiting restricts requests to 30 req/min per client. |

### 4.6 Elevation of Privilege (Access Control)

| Threat ID | Threat Description | Attack Vector | Mitigation Status | Technical Countermeasure |
|---|---|---|---|---|
| **E-01** | Arbitrary code execution via postinstall hooks | Host system executes package install scripts when ingesting dependencies. | **Mitigated** | WANNABE uses `pacote` and `tar` stream extraction only; `npm install` or child process execution is never invoked on untrusted packages. |
| **E-02** | RBAC bypass | Client with `viewer` role attempts to trigger verification scans or delete records. | **Mitigated** | `authorize(['analyst', 'admin'])` middleware strictly enforces role authorization on `/api/v1/scans` routes. |

---

## 5. Security Principles Implemented

1. **Zero-Execution Architecture**: Untrusted code is treated as data, never instructions.
2. **Deterministic-First Analysis**: Rule-based AST verification and Shannon entropy detection take precedence; AI provides narrative explanation rather than vulnerability detection.
3. **Fail-Closed Sandbox**: Any validation anomaly (path traversal, quota overrun, corrupted archive) terminates the scan immediately with explicit security exit codes.
4. **Least Privilege**: Containers and backend worker processes run without root privileges and with read-only root filesystems where possible.

<!-- TODO(security): Plan integration of automated CVE / Advisory feeds (e.g. OSV.dev) once core supply-chain verification rules stabilize. -->
