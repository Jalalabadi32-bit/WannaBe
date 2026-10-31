import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateScanRequestSchema } from '@wannabe/shared';
import { enqueueScan, getScan, listScans } from '../orchestrator/scan-worker.js';

interface ScanIdParams {
  id: string;
}

interface ScanListQuery {
  limit?: string;
  offset?: string;
}

export async function scanRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/v1/scans — Initiate verification scan
  fastify.post(
    '/api/v1/scans',
    {
      preHandler: [fastify.authenticate, fastify.authorize(['analyst', 'admin'])]
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = CreateScanRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid scan request parameters: ' + parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', '),
          details: parsed.error.flatten()
        });
      }

      const scanId = enqueueScan(parsed.data);
      return reply.status(202).send({
        scanId,
        status: 'queued',
        message: 'Verification scan queued successfully.'
      });
    }
  );

  // GET /api/v1/scans — List recent scans
  fastify.get<{ Querystring: ScanListQuery }>(
    '/api/v1/scans',
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      const allScans = listScans();
      const limit = Math.min(Math.max(Number(request.query?.limit ?? 20), 1), 100);
      const offset = Math.max(Number(request.query?.offset ?? 0), 0);

      return reply.status(200).send({
        total: allScans.length,
        limit,
        offset,
        items: allScans.slice(offset, offset + limit)
      });
    }
  );

  // GET /api/v1/scans/:id — Get scan status and progress
  fastify.get<{ Params: ScanIdParams }>(
    '/api/v1/scans/:id',
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      const { id } = request.params;
      const scan = getScan(id);

      if (!scan) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Scan '${id}' not found.`
        });
      }

      return reply.status(200).send({
        scanId: scan.id,
        id: scan.id,
        status: scan.status,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        error: scan.error
      });
    }
  );

  // GET /api/v1/scans/:id/report — Retrieve full verification report
  fastify.get<{ Params: ScanIdParams }>(
    '/api/v1/scans/:id/report',
    {
      preHandler: [fastify.authenticate]
    },
    async (request, reply) => {
      const { id } = request.params;
      const scan = getScan(id);

      if (!scan) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: `Scan '${id}' not found.`
        });
      }

      if (scan.status !== 'completed') {
        return reply.status(409).send({
          statusCode: 409,
          error: 'Conflict',
          message: `Scan '${id}' is currently '${scan.status}'. Report is only available once scan is completed.`
        });
      }

      return reply.status(200).send(scan);
    }
  );
}
