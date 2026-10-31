import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import { securityMiddleware } from './middleware/rate-limit.js';
import { authPlugin } from './middleware/auth.js';
import { systemRoutes } from './routes/system.js';
import { scanRoutes } from './routes/scans.js';

export interface AppConfig {
  jwtSecret?: string;
  apiKey?: string;
  rateLimitMax?: number;
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
}

export function buildApp(config?: AppConfig): FastifyInstance {
  const app = Fastify({
    logger: config?.logLevel ? { level: config.logLevel } : false
  });

  // 1. CORS Headers
  app.register(fastifyCors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  // 2. Security Headers & Rate Limiting (Helmet + 30 req/min)
  app.register(securityMiddleware, {
    max: config?.rateLimitMax ?? 30,
    timeWindow: '1 minute'
  });

  // 3. Auth plugin (JWT verify + X-API-Key + RBAC)
  app.register(authPlugin, {
    jwtSecret: config?.jwtSecret ?? process.env['JWT_SECRET'] ?? 'wannabe-dev-insecure-secret-key-change-in-prod',
    apiKey: config?.apiKey ?? process.env['WANNABE_API_KEY'] ?? 'wannabe-dev-api-key'
  });

  // 4. System Routes (/healthz, /readyz, /metrics)
  app.register(systemRoutes);

  // 5. Scan Routes (/api/v1/scans, /api/v1/scans/:id, /api/v1/scans/:id/report)
  app.register(scanRoutes);

  // 6. Custom 404 Handler conforming to ErrorResponse
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      statusCode: 404,
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found.`
    });
  });

  return app;
}

export async function startServer(): Promise<void> {
  const host = process.env['HOST'] ?? '0.0.0.0';
  const port = Number(process.env['PORT'] ?? 3000);
  const app = buildApp({ logLevel: 'info' });

  try {
    const address = await app.listen({ host, port });
    app.log.info(`WANNABE Fastify REST API listening at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
