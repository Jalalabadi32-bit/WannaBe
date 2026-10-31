# HACKATHON.md
 
## Team name
Spice Girls 

## Team members
Armaan Middha
Ishan Singh
 
## Problem statement
ps4 - Does the package match its source? Compare a published package with its source, explain every difference, and alert on suspicious releases.

## Models we use and why

- **Qwen/Qwen2.5-Coder-7B-Instruct**:
  - **Why**: Specialized open-source code intelligence model used to inspect suspicious discrepancies between source repositories and published package tarballs. It analyzes unmapped files, explains added lifecycle scripts (e.g., `postinstall`), assesses potential supply-chain risks, and provides human-readable explanations of code diffs.
- **sentence-transformers/all-MiniLM-L6-v2**:
  - **Why**: Lightweight open-source embedding model used to compute semantic similarity between source files and build artifacts (e.g. transpiled or bundled JavaScript vs. TypeScript source). It helps correlate expected compilation outputs and detect wholly alien/injected files that bear no semantic relationship to the source repository.
