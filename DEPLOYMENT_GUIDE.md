# Deployment & Scaling Guide (50,000 Concurrent Viewers)

## Prerequisites
- Node.js >= 20.x, pnpm >= 9.x
- Docker & Docker Compose
- PostgreSQL 16 (or AWS RDS PostgreSQL with connection pooling / PgBouncer)
- Redis 7 (or AWS ElastiCache / Redis Cluster)
- SRS (Simple Realtime Server) 5.x / 6.x or Cloudflare Stream / AWS MediaPackage

## Local Development Setup
```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure containers
docker compose up -d

# 3. Apply database migrations & seed sample concert data
pnpm db:push
pnpm db:seed

# 4. Run unit and load tests
pnpm test
pnpm test:load:50k

# 5. Start all applications concurrently
pnpm dev
```

## Production Topology for 50k Concurrency

### 1. Web & API Tier (Next.js 16)
- **Deployment**: Vercel Serverless / AWS ECS Fargate containers (minimum 4 tasks, auto-scaling up to 16 tasks on CPU > 70%).
- **Environment**: Set `NODE_OPTIONS="--max-old-space-size=4096"` for memory stability.
- **Edge CDN**: Cloudflare or AWS CloudFront configured with:
  - Cache static assets (`/_next/static/*`, `/images/*`): `public, max-age=31536000, immutable`.
  - Cache public catalog APIs (`/api/v1/events`): `public, s-maxage=10, stale-while-revalidate=30`.

### 2. Live Chat & Sockets Tier (`apps/realtime`)
- **Deployment**: Horizontally scaled Node.js Socket.IO instances behind an Application Load Balancer with sticky sessions.
- **Redis Adapter**: `@socket.io/redis-adapter` connected to Redis Cluster for inter-node message broadcasting.
- **Rate Limiting**: Enforce a 2-second per-user slow mode and pre-compiled regex trie filtering to prevent event loop blocking.

### 3. Video Origin & CDN Distribution
- **HLS/ABR Origin**: Primary SRS cluster ingesting RTMP/SRT from stage mixers at 1080p60 (~4,500 kbps) with secondary backup ingest.
- **ABR Ladder**: 1080p (4500 kbps), 720p (2500 kbps), 480p (1000 kbps), 360p (600 kbps).
- **HLS Segments**: 2-second chunks (`.ts` / `.m4s`) with 3-segment sliding playlists cached at edge CDN nodes.
- **Bandwidth Projection**: 50,000 viewers averaging 2.5 Mbps consumes ~125 Gbps aggregate egress, handled through Cloudflare or CloudFront.

### 4. Database & Redis Queue / Cache Topology

#### A. PostgreSQL 16 (Relational Ledger & Orders)
- **Sizing**: Min 4 vCPU, 16 GB RAM with PgBouncer connection pooling (max 200 server connections).
- **Workload**: Transactional ticket purchases, order checkout, double-entry gift ledger records, and user authentication.

#### B. Redis Realtime & Cache Tier (Ephemeral)
- **Purpose**: Socket.IO Redis Adapter for live chat room broadcasts, transient session caches, and rate-limiting counters.
- **Eviction Policy**: `maxmemory-policy: volatile-lru` (or `allkeys-lru`).
- **Cluster**: 3-node primary/replica Redis cluster.

#### C. Redis BullMQ Queue Tier (Dedicated & Persistent — NO EVICTION)
> [!IMPORTANT]
> **BullMQ strictly requires `noeviction`**: If Redis evicts keys used by BullMQ under memory pressure, queue jobs, locks, and task trees will be permanently lost or corrupted.
- **Instance**: Dedicated Redis 7 instance separated from cache/pubsub workloads.
- **Eviction Policy**: `maxmemory-policy: noeviction`.
- **Persistence**: `appendonly yes` with `appendfsync everysec` to guarantee queue durability across restarts.
