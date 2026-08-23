# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=2048
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-only placeholders. Runtime secrets are supplied by Compose and are not
# persisted in the standalone output.
ENV NODE_ENV=production \
    APP_URL=http://localhost:3000 \
    APP_PORT=3000 \
    APP_ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000 \
    AUTH_SECRET=build-time-placeholder-not-used-at-runtime-00000000 \
    DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder \
    AUTH_LOCAL_ENABLED=true \
    AUTHENTIK_ENABLED=false \
    DOCKER_CONTROL_ENABLED=false \
    DOCKER_LOGS_ENABLED=true \
    SYNOLOGY_ENABLED=false \
    SYNOLOGY_VERIFY_TLS=true \
    DEMO_MODE=false
RUN pnpm build

# Tooling image used only by the one-shot migration and seed services. It uses
# the exact same source tree and lockfile as the application build.
FROM node:24-alpine AS tools
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .
USER node
CMD ["./node_modules/.bin/tsx", "src/db/migrate.ts"]

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 vestyhub

COPY --from=builder /app/public ./public
COPY --from=builder --chown=vestyhub:nodejs /app/.next/standalone ./
COPY --from=builder --chown=vestyhub:nodejs /app/.next/static ./.next/static

USER vestyhub
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
