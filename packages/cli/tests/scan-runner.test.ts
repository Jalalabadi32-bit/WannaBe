/**
 * Unit tests for scan-runner.ts
 *
 * All @wannabe/core imports and node:fs/promises are mocked.
 * Tests cover:
 *   - CLIExecutionError construction
 *   - runScanCli happy path (returns completed report, exit code 0)
 *   - runScanCli auto-discovers gitTag when omitted
 *   - runScanCli auto-discovers repoUrl from package.json
 *   - runScanCli verbose flag does not throw
 *   - runScanCli failOn='warning' returns exit code 4 when flags exist
 */
import { describe, it, expect, vi } from 'vitest';

// --------------------------------------------------------------------------
// Mock @wannabe/core
// --------------------------------------------------------------------------
vi.mock('@wannabe/core', () => {
  const mockWorkspace = {
    packageDir: '/tmp/wannabe-cli-test/pkg',
    sourceDir: '/tmp/wannabe-cli-test/src',
    cleanup: vi.fn().mockResolvedValue(undefined)
  };

  const cleanSummary = {
    addedFiles: 0, modifiedFiles: 0, missingFiles: 0, identicalFiles: 3,
    criticalFlags: 0, highFlags: 0, mediumFlags: 0, lowFlags: 0
  };

  return {
    SandboxManager: vi.fn().mockImplementation(() => ({
      createWorkspace: vi.fn().mockResolvedValue(mockWorkspace),
      safeExtractTarball: vi.fn().mockResolvedValue(undefined)
    })),
    NpmFetcher: vi.fn().mockImplementation(() => ({
      fetchTarball: vi.fn().mockResolvedValue('/tmp/wannabe-cli-test/pkg/lodash.tgz')
    })),
    GitFetcher: vi.fn().mockImplementation(() => ({
      fetchSource: vi.fn().mockResolvedValue(undefined)
    })),
    GhostCodeComparator: vi.fn().mockImplementation(() => ({
      compareDirectories: vi.fn().mockResolvedValue({
        fileDiffs: [
          { path: 'lodash.js', status: 'identical', flags: [] },
          { path: 'package.json', status: 'identical', flags: [] }
        ],
        summary: cleanSummary
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
        summary: 'Clean package.',
        technicalAnalysis: 'No anomalies.',
        recommendations: ['Safe.'],
        modelAttribution: 'test'
      })
    })),
    SecurityError: class SecurityError extends Error {
      constructor(msg: string) { super(msg); this.name = 'SecurityError'; }
    }
  };
});

// Mock fs/promises — the runner reads package.json to discover the repoUrl
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: vi.fn().mockResolvedValue(
      JSON.stringify({
        name: 'lodash',
        version: '4.17.21',
        repository: { type: 'git', url: 'git+https://github.com/lodash/lodash.git' }
      })
    )
  }
}));

import { runScanCli, CLIExecutionError, computeExitCode } from '../src/runner/scan-runner.js';
import type { SecurityFlag } from '@wannabe/shared';

describe('scan-runner', () => {
  describe('CLIExecutionError', () => {
    it('carries the right exit code and name', () => {
      const err = new CLIExecutionError('npm fetch failed', 2);
      expect(err.exitCode).toBe(2);
      expect(err.name).toBe('CLIExecutionError');
      expect(err.message).toBe('npm fetch failed');
      expect(err instanceof Error).toBe(true);
    });

    it('exit code 3 is preserved for security violations', () => {
      const err = new CLIExecutionError('zip-slip detected', 3);
      expect(err.exitCode).toBe(3);
    });
  });

  describe('computeExitCode (edge cases)', () => {
    const highFlag: SecurityFlag = {
      ruleId: 'R-HIGH',
      severity: 'high',
      category: 'eval_execution',
      message: 'eval() found',
      filePath: 'index.js'
    };

    it('failOn=warning triggers exit 4 for high-severity flags', () => {
      expect(computeExitCode([highFlag], 'warning')).toBe(4);
    });

    it('failOn=critical does NOT trigger exit 4 for only high flags', () => {
      expect(computeExitCode([highFlag], 'critical')).toBe(0);
    });
  });

  describe('runScanCli', () => {
    it('returns completed ScanReport and exit code 0 for a clean scan', async () => {
      const result = await runScanCli({
        packageName: 'lodash',
        version: '4.17.21',
        repoUrl: 'https://github.com/lodash/lodash',
        gitTag: '4.17.21',
        offline: true
      });

      expect(result.report.status).toBe('completed');
      expect(result.exitCode).toBe(0);
      expect(result.report.target.packageName).toBe('lodash');
      expect(result.report.target.version).toBe('4.17.21');
      expect(Array.isArray(result.report.fileDiffs)).toBe(true);
      expect(result.report.aiVerdict).toBeDefined();
    });

    it('auto-defaults gitTag to v{version} when not provided', async () => {
      const result = await runScanCli({
        packageName: 'ms',
        version: '2.1.3',
        repoUrl: 'https://github.com/vercel/ms',
        offline: true
      });

      expect(result.report.target.gitTag).toBe('v2.1.3');
    });

    it('auto-discovers repoUrl from package.json when not provided', async () => {
      const result = await runScanCli({
        packageName: 'lodash',
        version: '4.17.21',
        offline: true
      });

      // The mock returns a repository.url with git+ prefix and .git suffix —
      // the runner should normalise it to a clean https URL
      expect(result.report.target.repoUrl).toContain('github.com');
      expect(result.report.target.repoUrl).not.toContain('git+');
      expect(result.report.target.repoUrl).not.toContain('.git');
    });

    it('verbose flag writes debug lines to stderr without throwing', async () => {
      const stderrLines: string[] = [];
      const origWrite = process.stderr.write.bind(process.stderr);
      process.stderr.write = (chunk: unknown) => {
        stderrLines.push(String(chunk));
        return true;
      };

      try {
        await runScanCli({
          packageName: 'chalk',
          version: '5.0.0',
          offline: true,
          verbose: true
        });
      } finally {
        process.stderr.write = origWrite;
      }

      expect(stderrLines.some((l) => l.includes('[wannabe:debug]'))).toBe(true);
    });

    it('failOn=critical returns exit code 0 when no critical flags found', async () => {
      const result = await runScanCli({
        packageName: 'semver',
        version: '7.0.0',
        offline: true,
        failOn: 'critical'
      });
      expect(result.exitCode).toBe(0);
    });

    it('failOn=never always returns exit code 0', async () => {
      const result = await runScanCli({
        packageName: 'debug',
        version: '4.3.4',
        offline: true,
        failOn: 'never'
      });
      expect(result.exitCode).toBe(0);
    });
  });
});
