import { describe, it, expect, vi } from 'vitest';
import {
  createCircuitBreaker,
  createNpmBreaker,
  createGitBreaker,
  createOllamaBreaker
} from '../src/resilience/index.js';
import { HybridAIExplainer } from '../src/ai/explainer-adapter.js';
import { NpmFetcher } from '../src/retrieval/npm-fetcher.js';
import { InMemoryCacheStore } from '../src/cache/index.js';
import type { ScanTarget, FileDiff, SecurityFlag, ScanSummary } from '@wannabe/shared';

describe('Core Resilience & Circuit Breakers', () => {
  describe('createCircuitBreaker core behavior', () => {
    it('executes successful actions and stays closed', async () => {
      const mockAction = vi.fn().mockResolvedValue('success');
      const breaker = createCircuitBreaker(mockAction, {
        name: 'test-action',
        timeout: 2000
      });

      const res = await breaker.fire();
      expect(res).toBe('success');
      expect(breaker.opened).toBe(false);
      expect(mockAction).toHaveBeenCalledTimes(1);
    });

    it('trips to open state when failure threshold is breached', async () => {
      const failingAction = vi.fn().mockRejectedValue(new Error('Downstream failure'));
      const breaker = createCircuitBreaker(failingAction, {
        name: 'test-failing-breaker',
        volumeThreshold: 2,
        errorThresholdPercentage: 50,
        resetTimeout: 5000
      });

      // Fire failures to trip breaker
      await expect(breaker.fire()).rejects.toThrow('Downstream failure');
      await expect(breaker.fire()).rejects.toThrow('Downstream failure');

      expect(breaker.opened).toBe(true);

      // Next invocation should fail fast without executing underlying action
      await expect(breaker.fire()).rejects.toThrow();
      expect(failingAction).toHaveBeenCalledTimes(2);
    });
  });

  describe('Service Breaker Factories', () => {
    it('creates pre-configured breakers with service identities', () => {
      const dummy = async () => 'ok';
      const npmB = createNpmBreaker(dummy);
      const gitB = createGitBreaker(dummy);
      const ollamaB = createOllamaBreaker(dummy);

      expect(npmB.name).toBe('npm-registry');
      expect(gitB.name).toBe('github-api');
      expect(ollamaB.name).toBe('ollama-inference');
    });
  });

  describe('HybridAIExplainer with Circuit Breaker', () => {
    const dummyTarget: ScanTarget = {
      packageName: 'chalk',
      version: '5.3.0'
    };
    const dummyDiffs: FileDiff[] = [];
    const dummyFlags: SecurityFlag[] = [];
    const dummySummary: ScanSummary = {
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

    it('falls back to deterministic explanation when Ollama breaker trips', async () => {
      const failingFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      const explainer = new HybridAIExplainer({
        fetchFn: failingFetch as unknown as typeof fetch,
        useBreaker: true
      });

      // Explain should gracefully return deterministic verdict
      const verdict = await explainer.explain(dummyTarget, dummyDiffs, dummyFlags, dummySummary);
      expect(verdict.riskLevel).toBe('clean');
      expect(verdict.modelAttribution).toContain('Deterministic Security Heuristic Engine');
    });
  });

  describe('NpmFetcher with Caching & Breaker', () => {
    it('caches metadata and avoids redundant fetch calls', async () => {
      const mockFetch = vi
        .fn()
        // 1st call: package metadata
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            dist: {
              tarball: 'https://registry.npmjs.org/chalk/-/chalk-5.3.0.tgz'
            }
          })
        })
        // 2nd call: tarball content
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          arrayBuffer: async () => new Uint8Array([31, 139, 8]).buffer
        });

      const cache = new InMemoryCacheStore();
      const fetcher = new NpmFetcher({
        fetchFn: mockFetch as unknown as typeof fetch,
        cache,
        useBreaker: true
      });

      const destDir = '/tmp/wannabe-cache-test-' + Date.now();
      await fetcher.fetchTarball('chalk', '5.3.0', destDir);

      // Verify metadata is now cached
      const cached = await cache.get('npm:meta:chalk:5.3.0');
      expect(cached).not.toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});
