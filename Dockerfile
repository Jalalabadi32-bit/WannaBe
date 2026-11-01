# Multi-stage Docker build for WANNABE Fastify REST API Gateway
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies (package manifests first for layer caching)
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY packages/api/package.json ./packages/api/
COPY packages/cli/package.json ./packages/cli/

RUN npm ci

# Copy source code and build all backend workspaces
COPY packages/shared ./packages/shared
COPY packages/core ./packages/core
COPY packages/api ./packages/api
COPY packages/cli ./packages/cli
RUN npm run build

# Production runtime stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Install runtime tools (curl for healthchecks, git for GitFetcher)
RUN apk add --no-cache curl git \
    && addgroup -S wannabe && adduser -S wannabe -G wannabe \
    && mkdir -p /tmp/wannabe-sandboxes \
    && chown -R wannabe:wannabe /tmp/wannabe-sandboxes

COPY --chown=wannabe:wannabe package.json package-lock.json ./
COPY --chown=wannabe:wannabe packages/shared/package.json ./packages/shared/
COPY --chown=wannabe:wannabe packages/core/package.json ./packages/core/
COPY --chown=wannabe:wannabe packages/api/package.json ./packages/api/
COPY --chown=wannabe:wannabe packages/cli/package.json ./packages/cli/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built artifacts from builder stage
COPY --from=builder --chown=wannabe:wannabe /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=wannabe:wannabe /app/packages/core/dist ./packages/core/dist
COPY --from=builder --chown=wannabe:wannabe /app/packages/api/dist ./packages/api/dist
COPY --from=builder --chown=wannabe:wannabe /app/packages/cli/dist ./packages/cli/dist

USER wannabe

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/healthz || exit 1

CMD ["node", "-e", "import('./packages/api/dist/server.js').then(m => m.startServer())"]
