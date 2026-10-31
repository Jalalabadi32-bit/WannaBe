/**
 * E2E integration test for the full WANNABE scan pipeline.
 *
 * Runs the real POST -> fetch -> extract -> analyze -> AI -> report flow
 * against lodash@4.17.21 (a tiny, well-known, clean package).
 *
 * Skipped unless RUN_E2E=1 is set so the unit suite stays fast in CI.
 * Requires: network access to registry.npmjs.org and github.com, plus git on PATH.
 * Ollama is optional — HybridAIExplainer falls back to rule-based heuristics.
 *
 * Usage:
 *   RUN_E2E=1 npx vitest run packages/api/tests/e2e.test.ts --reporter=verbose
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';

const E2E = process.env['RUN_E2E'] === '1';
const API_KEY = 'wannabe-dev-api-key';

describe.skipIf(!E2E)('E2E: full scan pipeline against lodash@4.17.21', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp({ apiKey: API_KEY, logLevel: 'silent' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    'completes end-to-end and returns a valid ScanReport',
    async () => {
      // 1. Initiate scan
      const postRes = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        headers: {
          'x-api-key': API_KEY,
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          packageName: 'lodash',
          version: '4.17.21',
          repoUrl: 'https://github.com/lodash/lodash',
          gitTag: '4.17.21'
        })
      });

      expect(postRes.statusCode, 'POST /api/v1/scans should return 202').toBe(202);
      const { scanId } = JSON.parse(postRes.body) as { scanId: string };
      expect(typeof scanId).toBe('string');
      expect(scanId.length).toBeGreaterThan(0);

      // 2. Poll until terminal state (max 90 s; lodash is ~30 kB)
      let report: Record<string, unknown> | null = null;

      for (let i = 0; i < 90; i++) {
        await new Promise((r) => setTimeout(r, 1000));

        const statusRes = await app.inject({
          method: 'GET',
          url: `/api/v1/scans/${scanId}`,
          headers: { 'x-api-key': API_KEY }
        });

        expect(statusRes.statusCode).toBe(200);
        const body = JSON.parse(statusRes.body) as Record<string, unknown>;

        if (body['status'] === 'completed') {
          const reportRes = await app.inject({
            method: 'GET',
            url: `/api/v1/scans/${scanId}/report`,
            headers: { 'x-api-key': API_KEY }
          });
          expect(reportRes.statusCode).toBe(200);
          report = JSON.parse(reportRes.body) as Record<string, unknown>;
          break;
        }

        if (body['status'] === 'failed') {
          throw new Error(`Scan failed: ${String(body['error'] ?? 'unknown error')}`);
        }
      }

      // 3. Validate ScanReport shape
      expect(report, 'Scan should complete within 90 s').not.toBeNull();
      expect(report!['id']).toBe(scanId);
      expect(report!['status']).toBe('completed');
      expect(Array.isArray(report!['fileDiffs'])).toBe(true);
      expect(Array.isArray(report!['flags'])).toBe(true);
      expect(report!['aiVerdict']).toBeDefined();

      // lodash 4.17.21 is a known-clean package — no critical flags expected
      const flags = report!['flags'] as Array<{ severity: string }>;
      const criticals = flags.filter((f) => f.severity === 'critical');
      expect(criticals.length).toBe(0);
    },
    90_000 // 90 s timeout
  );

  it('GET /api/v1/scans/:id/stream returns 404 for unknown scanId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/scans/00000000-0000-0000-0000-000000000000/stream'
    });
    expect(res.statusCode).toBe(404);
  });
});
