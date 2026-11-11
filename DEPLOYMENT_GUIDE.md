# Deployment Guide

## Prerequisites
- Node.js >= 20.x, pnpm >= 9.x
- Docker & Docker Compose
- PostgreSQL 16
- Redis 7
- SRS (Simple Realtime Server) 5.x / 6.x

## Local Development Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure containers
docker compose up -d

# 3. Apply database migrations & seed sample concert data
pnpm db:push
pnpm db:seed

# 4. Start all applications concurrently
pnpm dev
```

## Production Deployment Topology
- **Web & API**: Deployed as containerized Next.js Node.js server.
- **Realtime**: Deployed as dedicated Node.js service (`apps/realtime`) with Redis adapter for horizontal scaling.
- **Workers**: BullMQ worker instances (`apps/workers`) running background jobs.
- **Media Origin**: Scalable SRS cluster behind high-performance CDN (Cloudflare / Fastly / AWS CloudFront).
