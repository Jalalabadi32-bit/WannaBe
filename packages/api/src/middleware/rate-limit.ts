import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifyHelmet from '@fastify/helmet';

export interface RateLimitOptions {
  max?: number;
  timeWindow?: string | number;
}

export const securityMiddleware = fp(async (fastify: FastifyInstance, options: RateLimitOptions = {}) => {
  // 1. Security Headers via Helmet
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  });

  // 2. Token-bucket rate limiting (default 30 req/min)
  await fastify.register(fastifyRateLimit, {
    max: options.max ?? 30,
    timeWindow: options.timeWindow ?? '1 minute',
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded (threshold: ${context.max} req/${context.after}).`
    })
  });
});
