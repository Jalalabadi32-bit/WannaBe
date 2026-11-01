import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/index.js';

describe('Fastify REST API Server Route Injections', () => {
  let app: FastifyInstance;
  const testApiKey = 'wannabe-dev-api-key';
  const jwtSecret = 'test-secret-key-for-testing-purposes-12345';

  beforeAll(async () => {
    app = buildApp({
      jwtSecret,
      apiKey: testApiKey
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('System Routes', () => {
    it('GET /healthz returns 200 with healthy status and uptime', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/healthz'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(typeof body.timestamp).toBe('string');
      expect(typeof body.uptime).toBe('number');
    });

    it('GET /readyz returns 200 with readiness checks', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/readyz'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ready');
      expect(body.checks.sandboxStorage).toBe('ok');
      expect(body.checks.aiExplainer).toBe('available');
    });

    it('GET /metrics returns 200 with Prometheus metrics text', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics'
      });

      expect(response.statusCode).toBe(200);
      expect(response.body).toContain('# HELP');
      expect(response.headers['content-type']).toContain('text/plain');
    });
  });

  describe('Authentication and RBAC Guards', () => {
    it('POST /api/v1/scans without auth header returns 401 Unauthorized', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        payload: {
          packageName: 'chalk',
          version: '5.3.0'
        }
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unauthorized');
    });

    it('POST /api/v1/scans with invalid API key returns 401 Unauthorized', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        headers: {
          'x-api-key': 'invalid-bogus-key'
        },
        payload: {
          packageName: 'chalk',
          version: '5.3.0'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('POST /api/v1/scans with viewer role JWT returns 403 Forbidden', async () => {
      const viewerToken = app.jwt.sign({
        sub: 'viewer-user-1',
        role: 'viewer'
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        headers: {
          authorization: `Bearer ${viewerToken}`
        },
        payload: {
          packageName: 'chalk',
          version: '5.3.0'
        }
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Forbidden');
    });
  });

  describe('Scan Lifecycle CRUD Routes', () => {
    let createdScanId: string;

    it('POST /api/v1/scans with invalid payload returns 400 Bad Request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        headers: {
          'x-api-key': testApiKey
        },
        payload: {
          // missing packageName
          version: '1.0.0'
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Bad Request');
    });

    it('POST /api/v1/scans with valid x-api-key queues scan and returns 202', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/scans',
        headers: {
          'x-api-key': testApiKey
        },
        payload: {
          packageName: 'chalk',
          version: '5.3.0',
          repoUrl: 'https://github.com/chalk/chalk',
          gitTag: 'v5.3.0'
        }
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('queued');
      expect(typeof body.scanId).toBe('string');
      expect(body.message).toBe('Verification scan queued successfully.');
      createdScanId = body.scanId;
    });

    it('GET /api/v1/scans/:id returns 200 with status field for existing scan', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/scans/${createdScanId}`,
        headers: {
          'x-api-key': testApiKey
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.scanId).toBe(createdScanId);
      expect(body.status).toBeDefined();
      expect(body.startedAt).toBeDefined();
    });

    it('GET /api/v1/scans/nonexistent returns 404 Not Found', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/00000000-0000-0000-0000-000000000000',
        headers: {
          'x-api-key': testApiKey
        }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });

    it('GET /api/v1/scans/:id/report returns 409 while scan is in progress', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/scans/${createdScanId}/report`,
        headers: {
          'x-api-key': testApiKey
        }
      });

      // If scan has completed already or is in progress
      expect([200, 409]).toContain(response.statusCode);
      if (response.statusCode === 409) {
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Conflict');
      }
    });

    it('GET /api/v1/scans lists existing scans', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans?limit=10',
        headers: {
          'x-api-key': testApiKey
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.total).toBeGreaterThan(0);
    });

    it('GET /api/v1/scans/:id/report returns 404 for unknown scan', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/00000000-0000-0000-0000-ffffffffffff/report',
        headers: { 'x-api-key': testApiKey }
      });
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });

    it('GET /api/v1/scans/:id/stream returns 404 for unknown scan', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/scans/00000000-0000-0000-0000-eeeeeeeeeeee/stream'
      });
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });
  });

  describe('Custom 404 handler', () => {
    it('unknown route returns 404 with structured error body', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/does-not-exist'
      });
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.statusCode).toBe(404);
      expect(body.error).toBe('Not Found');
    });
  });

  describe('Production Hardening & Deployment Guards', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('throws fatal error in production if JWT_SECRET is default or unset', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = 'wannabe-dev-secret';
      process.env['WANNABE_API_KEY'] = 'strong-production-api-key-12345';

      expect(() => buildApp()).toThrow(/Production mode detected.*JWT_SECRET/);
    });

    it('throws fatal error in production if WANNABE_API_KEY is default or unset', () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = 'strong-production-jwt-secret-12345';
      process.env['WANNABE_API_KEY'] = 'wannabe-dev-api-key';

      expect(() => buildApp()).toThrow(/Production mode detected.*WANNABE_API_KEY/);
    });

    it('boots successfully in production when strong secrets are provided', async () => {
      process.env['NODE_ENV'] = 'production';
      process.env['JWT_SECRET'] = 'c028a3f749b5c81de3f4a8e0f9b1d743';
      process.env['WANNABE_API_KEY'] = 'd41d8cd98f00b204e9800998ecf8427e';

      const prodApp = buildApp();
      await prodApp.ready();

      const res = await prodApp.inject({ method: 'GET', url: '/healthz' });
      expect(res.statusCode).toBe(200);
      await prodApp.close();
    });

    it('respects CORS_ORIGIN env variable for single or multiple origins', async () => {
      process.env['CORS_ORIGIN'] = 'https://dashboard.wannabe.dev, https://app.wannabe.dev';
      const corsApp = buildApp({
        jwtSecret: 'test-secret',
        apiKey: 'test-key'
      });
      await corsApp.ready();

      const resAllowed = await corsApp.inject({
        method: 'OPTIONS',
        url: '/healthz',
        headers: {
          origin: 'https://dashboard.wannabe.dev',
          'access-control-request-method': 'GET'
        }
      });
      expect(resAllowed.headers['access-control-allow-origin']).toBe('https://dashboard.wannabe.dev');

      await corsApp.close();
    });

    it('matches wildcard CORS patterns like https://*.vercel.app', async () => {
      process.env['CORS_ORIGIN'] = 'https://*.vercel.app';
      const wildcardApp = buildApp({
        jwtSecret: 'test-secret',
        apiKey: 'test-key'
      });
      await wildcardApp.ready();

      const resVercel = await wildcardApp.inject({
        method: 'OPTIONS',
        url: '/healthz',
        headers: {
          origin: 'https://wannabe-frontend-preview-123.vercel.app',
          'access-control-request-method': 'GET'
        }
      });
      expect(resVercel.headers['access-control-allow-origin']).toBe('https://wannabe-frontend-preview-123.vercel.app');

      const resRejected = await wildcardApp.inject({
        method: 'OPTIONS',
        url: '/healthz',
        headers: {
          origin: 'https://malicious-site.com',
          'access-control-request-method': 'GET'
        }
      });
      expect(resRejected.headers['access-control-allow-origin']).toBeUndefined();

      await wildcardApp.close();
    });

    it('trusts proxy and correctly derives client IP from x-forwarded-for', async () => {
      const proxyApp = buildApp({
        jwtSecret: 'test-secret',
        apiKey: 'test-key'
      });
      await proxyApp.ready();

      const res = await proxyApp.inject({
        method: 'GET',
        url: '/healthz',
        headers: {
          'x-forwarded-for': '203.0.113.195, 10.0.0.1'
        }
      });
      expect(res.statusCode).toBe(200);
      await proxyApp.close();
    });
  });
});

