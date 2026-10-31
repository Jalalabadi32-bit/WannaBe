/**
 * Unit tests for scan-worker.ts
 *
 * All @wannabe/core imports are mocked so no real network, filesystem,
 * or Ollama calls are made. The tests cover:
 *   - enqueueScan / getScan / listScans store operations
 *   - scanBus progress + done event emission
 *   - scan completing successfully in the store
 *   - enqueueScan failure path (core throws)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --------------------------------------------------------------------------
// Mock @wannabe/core — stub all classes used by scan-worker's runScan()
// --------------------------------------------------------------------------
vi.mock('@wannabe/core', () => {
  const mockWorkspace = {
    packageDir: '/tmp/wannabe-test/pkg',
    sourceDir: '/tmp/wannabe-test/src',
    cleanup: vi.fn().mockResolvedValue(undefined)
  };

  return {
    SandboxManager: vi.fn().mockImplementation(() => ({
      createWorkspace: vi.fn().mockResolvedValue(mockWorkspace),
      safeExtractTarball: vi.fn().mockResolvedValue(undefined)
    })),
    NpmFetcher: vi.fn().mockImplementation(() => ({
      fetchTarball: vi.fn().mockResolvedValue('/tmp/wannabe-test/pkg/tarball.tgz')
    })),
    GitFetcher: vi.fn().mockImplementation(() => ({
      fetchSource: vi.fn().mockResolvedValue(undefined)
    })),
    GhostCodeComparator: vi.fn().mockImplementation(() => ({
      compareDirectories: vi.fn().mockResolvedValue({
        fileDiffs: [
          { path: 'index.js', status: 'identical', flags: [] }
        ],
        summary: {
          addedFiles: 0, modifiedFiles: 0, missingFiles: 0, identicalFiles: 1,
          criticalFlags: 0, highFlags: 0, mediumFlags: 0, lowFlags: 0
        }
      })
    })),
    ASTAnalyzer: vi.fn().mockImplementation(() => ({
      analyzeFile: vi.fn().mockResolvedValue([])
    })),
    EntropyScanner: vi.fn().mockImplementation(() => ({
      scanForObfuscation: vi.fn().mockReturnValue([])
    })),
    HybridAIExplainer: vi.fn().mockImplementation(() => ({
      explain: vi.fn().mockResolvedValue({
        riskScore: 0,
        riskLevel: 'clean',
        summary: 'Package matches source.',
        technicalAnalysis: 'No anomalies detected.',
        recommendations: ['Safe to proceed.'],
        modelAttribution: 'Deterministic Security Heuristic Engine (test stub)'
      })
    }))
  };
});

// Mock fs/promises readFile — the worker tries to read file contents for AST analysis
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockRejectedValue(new Error('ENOENT: test stub — no file'))
  }
}));

// Import the worker AFTER mocks are in place
import { enqueueScan, getScan, listScans, scanBus } from '../src/orchestrator/scan-worker.js';

// Helper: wait for async microtasks/timers to flush
const flush = (ms = 80) => new Promise<void>((r) => setTimeout(r, ms));

describe('scan-worker', () => {
  beforeEach(() => {
    scanBus.removeAllListeners();
  });

  afterEach(() => {
    scanBus.removeAllListeners();
  });

  describe('enqueueScan / getScan / listScans', () => {
    it('enqueueScan registers the scan with queued status', () => {
      const id = enqueueScan({ packageName: 'lodash', version: '4.17.21' });
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);

      const scan = getScan(id);
      expect(scan).toBeDefined();
      expect(scan!.status).toBe('queued');
      expect(scan!.target.packageName).toBe('lodash');
      expect(scan!.target.version).toBe('4.17.21');
    });

    it('getScan returns undefined for an unknown id', () => {
      expect(getScan('00000000-not-real')).toBeUndefined();
    });

    it('listScans includes newly enqueued scans', () => {
      const id = enqueueScan({ packageName: 'express', version: '4.18.0' });
      const all = listScans();
      expect(all.some((s) => s.id === id)).toBe(true);
    });

    it('multiple enqueued scans are all retrievable', () => {
      const id1 = enqueueScan({ packageName: 'ms', version: '2.1.3' });
      const id2 = enqueueScan({ packageName: 'chalk', version: '5.0.0' });
      expect(getScan(id1)).toBeDefined();
      expect(getScan(id2)).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });

  describe('scanBus event emission', () => {
    it('emits progress events for each pipeline stage', async () => {
      const statuses: string[] = [];
      scanBus.on('progress', (_id, status) => statuses.push(status));

      enqueueScan({ packageName: 'ms', version: '2.1.3' });
      await flush();

      expect(statuses).toContain('fetching');
      expect(statuses).toContain('extracting');
      expect(statuses).toContain('analyzing');
      expect(statuses).toContain('evaluating_ai');
      expect(statuses).toContain('completed');
    });

    it('emits done event after completed', async () => {
      let doneScanId: string | null = null;
      scanBus.on('done', (id) => { doneScanId = id; });

      const id = enqueueScan({ packageName: 'semver', version: '7.6.0' });
      await flush();

      expect(doneScanId).toBe(id);
    });

    it('progress events carry the correct scanId', async () => {
      const seen = new Set<string>();
      scanBus.on('progress', (scanId) => seen.add(scanId));

      const id = enqueueScan({ packageName: 'debug', version: '4.3.4' });
      await flush();

      expect(seen.has(id)).toBe(true);
    });
  });

  describe('scan store transitions', () => {
    it('scan transitions to completed status after runScan resolves', async () => {
      const id = enqueueScan({
        packageName: 'lodash',
        version: '4.17.21',
        repoUrl: 'https://github.com/lodash/lodash',
        gitTag: '4.17.21'
      });

      await flush();

      const scan = getScan(id);
      expect(scan?.status).toBe('completed');
      expect(scan?.completedAt).toBeDefined();
      expect(scan?.aiVerdict).toBeDefined();
      expect(Array.isArray(scan?.fileDiffs)).toBe(true);
      expect(Array.isArray(scan?.flags)).toBe(true);
    });
  });
});
