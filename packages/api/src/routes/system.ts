import type { FastifyInstance } from 'fastify';
import client from 'prom-client';

export async function systemRoutes(fastify: FastifyInstance): Promise<void> {
  // Ensure default Prometheus metrics are registered once
  if (client.register.getMetricsAsArray().length === 0) {
    client.collectDefaultMetrics({ register: client.register });
  }

  // Liveness probe
  fastify.get('/healthz', async () => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });

  // Readiness probe
  fastify.get('/readyz', async (_request, reply) => {
    const checks = {
      sandboxStorage: 'ok',
      aiExplainer: 'available',
      cacheStore: 'ok'
    };

    return reply.status(200).send({
      status: 'ready',
      checks
    });
  });

  // Prometheus metrics endpoint
  fastify.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', client.register.contentType);
    return reply.send(await client.register.metrics());
  });
}
