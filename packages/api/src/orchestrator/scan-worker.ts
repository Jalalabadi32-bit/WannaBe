import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import EventEmitter from 'node:events';
import type { ScanReport, ScanTarget, ScanStatus, FileDiff } from '@wannabe/shared';
import {
  SandboxManager,
  NpmFetcher,
  GitFetcher,
  GhostCodeComparator,
  ASTAnalyzer,
  EntropyScanner,
  HybridAIExplainer
} from '@wannabe/core';

// Typed event bus for real-time scan lifecycle events.
// Subscribers: SSE route (packages/api/src/routes/scans.ts).
// TODO: swap emitter subscriber for Redis pub/sub (SUBSCRIBE wannabe:scan:*)
//       once a persistent multi-replica deployment is needed.
type ScanEvents = {
  progress: (scanId: string, status: ScanStatus) => void;
  done: (scanId: string) => void;
};

// Inline typed-emitter interface so we keep IDE-level event type safety
// without pulling in a runtime dependency.
interface TypedScanBus extends EventEmitter {
  emit<E extends keyof ScanEvents>(event: E, ...args: Parameters<ScanEvents[E]>): boolean;
  on<E extends keyof ScanEvents>(event: E, listener: ScanEvents[E]): this;
  off<E extends keyof ScanEvents>(event: E, listener: ScanEvents[E]): this;
  once<E extends keyof ScanEvents>(event: E, listener: ScanEvents[E]): this;
}

export const scanBus = new EventEmitter() as TypedScanBus;
scanBus.setMaxListeners(0); // allow one listener per active SSE connection

// In-memory scan store — suitable for single-instance dev; swap backing store for Redis
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
    scanBus.emit('progress', scanId, 'fetching');

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
    scanBus.emit('progress', scanId, 'extracting');
    await sandbox.safeExtractTarball(tarballPath, workspace.packageDir);

    // Fetch GitHub source into workspace source dir
    if (target.repoUrl && target.gitTag) {
      await gitFetcher.fetchSource(target.repoUrl, target.gitTag, workspace.sourceDir);
    }

    // Compare directories
    patch(scanId, { status: 'analyzing' });
    scanBus.emit('progress', scanId, 'analyzing');
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
    scanBus.emit('progress', scanId, 'evaluating_ai');
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
    scanBus.emit('progress', scanId, 'completed');
    scanBus.emit('done', scanId);
  } finally {
    await workspace.cleanup();
  }
}
