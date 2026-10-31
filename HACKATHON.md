# HACKATHON.md

# WANNABE
> **Trust the Source. Verify the Package.**  
> *Automated Supply-Chain Security & Source-to-Package Verification Engine*

---

## Team name
**Spice Girls**

## Team members
- **Armaan Middha**
- **Ishan Singh**

## Problem statement
**PS 4 – Does the Package Match Its Source?**  
Compare a published package with its source, explain every difference, and alert on suspicious releases.

---

## Models we use and why

### 1. Google Gemma 4 E4B (Fallback: Gemma 4 E2B / Gemma 2 series)
- **Deployment**: Local inference via **Ollama** (leveraging NVIDIA RTX 5050 8 GB VRAM; lightweight quantized model for low-latency, offline execution).
- **Why we use it**:
  - **Evidence-Grounded AI Security Analyst**: Rather than guessing or hallucinating vulnerabilities, Gemma ingests structured, deterministic scanner evidence (diff summaries, AST analysis outputs, entropy spikes, and package lifecycle hooks) and translates technical anomalies into actionable, plain-English security advisories.
  - **Deobfuscation & Risk Reasoning**: Analyzes unfamiliar scripts (e.g., newly introduced `postinstall` or `preinstall` scripts) and flags dangerous capabilities (network sockets, environment variable exfiltration, child-process spawning).
  - **Strict Separation of Concerns**: Deterministic code verification remains isolated in the AST/hashing engine. Gemma strictly interprets the evidence to avoid false positives or hallucinations.

---

## Project Overview

| Detail | Information |
|---|---|
| **Project** | **WANNABE** |
| **Problem Statement** | Problem 4 — Does the package match its source? |
| **Category** | Software Supply Chain Security |
| **Event** | Hacktoberfest HackDay – Sonipat (NST • Rishihood University) |
| **License** | MIT License |

---

## 1. The Threat Model & Problem

Modern software development relies heavily on third-party package registries like npm. However, what developers review on GitHub is not necessarily what is published to npm:
- **Hidden Lifecycle Hooks**: Malicious actors introduce `preinstall` or `postinstall` scripts only in the published tarball to compromise host machines upon `npm install`.
- **Injected & Obfuscated Payloads**: Minified or obfuscated files (`lib/x.min.js`, base64 payloads, dynamic `eval()`) that have no corresponding source file in the git repository.
- **Silent Discrepancies**: Subtle modifications made to compiled artifacts (`dist/`) that deviate from reproducible build outputs of `src/`.

**WANNABE** solves this challenge by answering one critical question:  
👉 **Does the published package actually match its claimed source code?**

---

## 2. Our Solution & Architecture

WANNABE performs multi-stage verification comparing an npm package release against its corresponding GitHub source tag.

```
┌─────────────────────────┐             ┌─────────────────────────┐
│   GitHub Source Code    │             │   Published npm Package  │
│   (e.g., git tag v2.1.0)│             │   (e.g., tarball v2.1.0) │
└────────────┬────────────┘             └────────────┬────────────┘
             │                                       │
             ▼                                       ▼
    Safe Extraction & Ingestion        Safe Extraction & Ingestion
             │                                       │
             └───────────────────┬───────────────────┘
                                 │
                                 ▼
         ┌───────────────────────────────────────────────┐
         │       Deterministic Verification Engine       │
         │  • SHA-256 Checksums & File Tree Alignment    │
         │  • Manifest & Lifecycle Hook Diffing          │
         │  • AST Analysis & High-Entropy Detection      │
         │  • Expected vs. Anomaly Classification        │
         └───────────────────────┬───────────────────────┘
                                 │
                                 ▼
                     Structured Findings & Diffs
                                 │
                                 ▼
         ┌───────────────────────────────────────────────┐
         │           Gemma AI Security Analyst           │
         │       (Local Inference via Ollama)            │
         │  • Explains suspicious differences in English │
         │  • Identifies threat patterns & attack intent │
         │  • Contextual risk scoring & recommendations  │
         └───────────────────────┬───────────────────────┘
                                 │
                                 ▼
                     Interactive Web Dashboard
                    (Evidence & Security Report)
```

### Key Capabilities
1. **Automated Source & Package Retrieval**: Fetches published npm tarballs and checks out matching GitHub release tags.
2. **File Tree & Cryptographic Hash Auditing**: Computes SHA-256 hashes to map modified, missing, and newly added files.
3. **Build Artifact Disambiguation**: Differentiates standard build outputs (e.g., TypeScript transpiled into JavaScript) from unmapped, rogue files.
4. **Manifest & Script Anomaly Detection**: Highlights uncommitted lifecycle scripts (`preinstall`, `install`, `postinstall`).
5. **Entropy & Obfuscation Detection**: Automatically flags obfuscated strings, packed code, and hidden network calls.
6. **AI-Assisted Security Explanation**: Gemma translates raw cryptographic and structural diffs into an executive security audit report.

---

## 3. Technology Stack

| Layer | Component | Description |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS | High-performance interactive dashboard for inspecting file diffs, risk scores, and evidence trees |
| **Backend** | Python 3, FastAPI, Pydantic | Asynchronous REST API orchestrating retrieval, extraction, and scanner execution |
| **Local AI Engine** | Google Gemma 4 E4B / E2B | Local LLM inference executed via **Ollama** on NVIDIA RTX 5050 GPU |
| **Package Engine** | npm Registry API, `pacote` | Secure tarball downloading and metadata extraction |
| **Source Engine** | GitHub REST API, Git CLI | Repository cloning, tag matching, and commit verification |
| **Analysis Core** | SHA-256, AST parsers, regex heuristics | Deterministic structural, syntactic, and cryptographic analysis |
| **Test & CI** | `pytest`, GitHub Actions | Automated regression testing and security verification suites |

---

## 4. Analysis Workflow

1. **Input**: User submits the target npm package name, release version, and GitHub repository URL.
2. **Artifact Ingestion**: WANNABE fetches the exact npm release tarball and checks out the corresponding GitHub release tag.
3. **Safe Extraction**: Both artifacts are unpacked in isolated staging directories with path traversal protections.
4. **Structural Audit**: The engine generates a side-by-side file manifest, identifying:
   - Identical files (hash matches)
   - Expected build artifacts (e.g., `src/index.ts` -> `dist/index.js`)
   - Suspicious additions (files not present in git repo)
   - Manifest drift (extra scripts in `package.json`)
5. **Deep Inspection**: High-risk files (such as unknown `.min.js` or installation scripts) undergo AST and entropy scanning.
6. **AI Explanation**: Gemma reviews the scanner's structured JSON findings to generate a contextual, evidence-backed narrative.
7. **Report Generation**: The frontend renders an interactive verdict dashboard: Clean, Questionable, or Critical Threat.

---

## 5. Security & Safety Principles

- **Zero-Execution Sandbox**: Downloaded packages are treated as untrusted data. Package scripts (`postinstall`, etc.) are **never** executed on the host.
- **Path Traversal Defense**: All archive decompression is strictly validated against `zip slip` and path traversal vulnerabilities.
- **Deterministic First**: AI never invents findings; it is strictly an explanation and reasoning layer over deterministic scanner evidence.
- **Local & Private**: Gemma runs entirely locally on Ollama; no proprietary code or audit data leaves the local machine.
- **Honest Confidence**: The system highlights uncertainty and build-transpilation limits rather than guaranteeing absolute safety.

---

## 6. Open Source & License

WANNABE is developed as an open-source security tool under the **MIT License**.
