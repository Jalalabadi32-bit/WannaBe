import { describe, it, expect } from 'vitest';
import type { ScanTarget, FileDiff, SecurityFlag, ScanSummary } from '@wannabe/shared';
import { HybridAIExplainer } from '../src/ai/explainer-adapter.js';

describe('HybridAIExplainer', () => {
  const target: ScanTarget = {
    packageName: 'test-pkg',
    version: '1.0.0',
    repoUrl: 'https://github.com/org/test-pkg'
  };

  const cleanSummary: ScanSummary = {
    totalFilesSource: 5,
    totalFilesPackage: 5,
    matchedFiles: 5,
    modifiedFiles: 0,
    addedFiles: 0,
    missingFiles: 0,
    expectedArtifacts: 0,
    criticalFlags: 0,
    highFlags: 0,
    mediumFlags: 0,
    lowFlags: 0,
    infoFlags: 0
  };

  it('produces clean verdict for matching clean package in offline mode', async () => {
    const explainer = new HybridAIExplainer({ forceDeterministic: true });
    const verdict = await explainer.explain(target, [], [], cleanSummary);

    expect(verdict.riskLevel).toBe('clean');
    expect(verdict.riskScore).toBe(0);
    expect(verdict.modelAttribution).toContain('Deterministic Security Heuristic Engine');
    expect(verdict.recommendations.length).toBeGreaterThan(0);
  });

  it('produces critical verdict when critical security flags exist', async () => {
    const criticalSummary: ScanSummary = {
      ...cleanSummary,
      criticalFlags: 1,
      addedFiles: 1
    };

    const flags: SecurityFlag[] = [
      {
        ruleId: 'WANNABE-UNCOMMITTED-HOOK',
        severity: 'critical',
        category: 'lifecycle_hook',
        message: 'Uncommitted postinstall script executing curl',
        filePath: 'package.json'
      }
    ];

    const diffs: FileDiff[] = [
      {
        path: 'package.json',
        status: 'modified',
        sizeDiffBytes: 10,
        flags
      }
    ];

    const explainer = new HybridAIExplainer({ forceDeterministic: true });
    const verdict = await explainer.explain(target, diffs, flags, criticalSummary);

    expect(verdict.riskLevel).toBe('critical');
    expect(verdict.riskScore).toBeGreaterThanOrEqual(35);
    expect(verdict.summary).toContain('critical');
    expect(verdict.recommendations[0]).toContain('Do NOT install');
  });

  it('uses Ollama response when available and responds with valid JSON', async () => {
    const mockOllamaResponse = {
      riskScore: 85,
      riskLevel: 'critical',
      summary: 'Malicious postinstall found.',
      technicalAnalysis: 'Script downloads payload.',
      recommendations: ['Do not run.']
    };

    const mockFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        response: JSON.stringify(mockOllamaResponse)
      })
    } as unknown as Response);

    const explainer = new HybridAIExplainer({ fetchFn: mockFetch });
    const verdict = await explainer.explain(target, [], [], cleanSummary);

    expect(verdict.riskScore).toBe(85);
    expect(verdict.riskLevel).toBe('critical');
    expect(verdict.modelAttribution).toContain('Gemma');
    expect(verdict.summary).toBe('Malicious postinstall found.');
  });

  it('falls back to deterministic engine if Ollama endpoint throws error', async () => {
    const mockFetch = async () => {
      throw new Error('Connection refused (Ollama offline)');
    };

    const explainer = new HybridAIExplainer({ fetchFn: mockFetch });
    const verdict = await explainer.explain(target, [], [], cleanSummary);

    expect(verdict.riskLevel).toBe('clean');
    expect(verdict.modelAttribution).toContain('Deterministic Security Heuristic Engine');
  });
});
