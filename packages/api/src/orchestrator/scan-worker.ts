import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ScanReport, ScanTarget, FileDiff } from '@wannabe/shared';
import {
  SandboxManager,
  NpmFetcher,
  GitFetcher,
  GhostCodeComparator,
  ASTAnalyzer,
  EntropyScanner,
  HybridAIExplainer
} from '@wannabe/core';

// In-memory scan store — swap for Redis in a follow-up
const scanStore = new Map<string, ScanReport>();

export function getScan(scanId: string): ScanReport | undefined {
  return scanStore.get(scanId);
}

export function listScans(): ScanReport[] {
  return Array.from(scanStore.values());
}

function patch(scanId: string, updates: Partial<ScanReport>): void {
  const existing = scanStore.get(scanId);
  if (existing) scanStore.set(scanId, { ...existing, ...updates });
}

export function enqueueScan(target: ScanTarget): string {
  const scanId = randomUUID();
  scanStore.set(scanId, {
    id: scanId,
    target,
    status: 'queued',
    startedAt: new Date().toISOString(),
    fileDiffs: [],
    flags: []
  });
  runScan(scanId, target).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    patch(scanId, { status: 'failed', completedAt: new Date().toISOString(), error: msg });
  });
  return scanId;
}

async function runScan(scanId: string, target: ScanTarget): Promise<void> {
  const sandbox = new SandboxManager();
  const workspace = await sandbox.createWorkspace(scanId);

  try {
    patch(scanId, { status: 'fetching' });

    const npmFetcher = new NpmFetcher();
    const gitFetcher = new GitFetcher();

    // Fetch npm tarball into workspace package dir
    const tarballPath = await npmFetcher.fetchTarball(
      target.packageName,
      target.version,
      workspace.packageDir
    );

    // Extract npm tarball in-place
    patch(scanId, { status: 'extracting' });
    await sandbox.safeExtractTarball(tarballPath, workspace.packageDir);

    // Fetch GitHub source into workspace source dir
    if (target.repoUrl && target.gitTag) {
      await gitFetcher.fetchSource(target.repoUrl, target.gitTag, workspace.sourceDir);
    }

    // Compare directories
    patch(scanId, { status: 'analyzing' });
    const comparator = new GhostCodeComparator();
    const { fileDiffs, summary: rawSummary } = await comparator.compareDirectories(
      workspace.sourceDir,
      workspace.packageDir
    );

    // AST + entropy analysis on JS/TS files
    const astAnalyzer = new ASTAnalyzer();
    const entropyScanner = new EntropyScanner();

    for (const diff of fileDiffs) {
      if (diff.status === 'missing_in_package') continue;
      const ext = diff.path.split('.').pop()?.toLowerCase() ?? '';
      if (!['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx'].includes(ext)) continue;

      // Try reading from package dir
      const absPath = join(workspace.packageDir, diff.path);
      let content: string;
      try {
        content = await readFile(absPath, 'utf8');
      } catch {
        continue;
      }

      const astFlags = await astAnalyzer.analyzeFile(diff.path, content);
      const entropyFlags = entropyScanner.scanForObfuscation(diff.path, content);
      diff.flags = [...(diff.flags ?? []), ...astFlags, ...entropyFlags];
    }

    const allFlags = fileDiffs.flatMap((d: FileDiff) => d.flags ?? []);

    // AI explanation
    patch(scanId, { status: 'evaluating_ai' });
    const explainer = new HybridAIExplainer();
    const verdict = await explainer.explain(target, fileDiffs, allFlags, rawSummary);

    patch(scanId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      fileDiffs,
      flags: allFlags,
      aiVerdict: verdict,
      summary: rawSummary
    });
  } finally {
    await workspace.cleanup();
  }
}
