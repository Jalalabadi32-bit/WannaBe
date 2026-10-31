import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { UserRole, AuthUser } from '@wannabe/shared';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: AuthUser;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (allowedRoles: UserRole[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AuthPluginOptions {
  jwtSecret: string;
  apiKey?: string;
}

export const authPlugin = fp(async (fastify: FastifyInstance, options: AuthPluginOptions) => {
  await fastify.register(fastifyJwt, {
    secret: options.jwtSecret
  });

  const validApiKey = options.apiKey ?? process.env['WANNABE_API_KEY'] ?? 'wannabe-dev-api-key';

  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // 1. Check API Key header
      const apiKeyHeader = request.headers['x-api-key'];
      if (typeof apiKeyHeader === 'string' && apiKeyHeader.length > 0) {
        if (apiKeyHeader === validApiKey) {
          request.user = {
            id: 'api-key-system',
            username: 'ci-service',
            email: 'ci@wannabe.local',
            role: 'admin'
          };
          return;
        }
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid X-API-Key header provided.'
        });
      }

      // 2. Check Bearer Token
      try {
        await request.jwtVerify();
        // Extract user from verified JWT payload
        const payload = request.user as unknown as { user?: AuthUser; role?: UserRole; sub?: string };
        if (payload?.user) {
          request.user = payload.user;
        } else if (payload?.sub) {
          request.user = {
            id: payload.sub,
            username: 'jwt-user',
            email: 'user@wannabe.local',
            role: payload.role ?? 'analyst'
          };
        }
      } catch {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Authentication required. Provide a valid Bearer token or X-API-Key.'
        });
      }
    }
  );

  fastify.decorate(
    'authorize',
    (allowedRoles: UserRole[]) => {
      return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
        if (!request.user) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'Authentication required.'
          });
        }

        if (!allowedRoles.includes(request.user.role)) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: `User role "${request.user.role}" does not have required permissions for this action.`
          });
        }
      };
    }
  );
});
