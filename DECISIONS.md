# Architectural Decisions (ADR)

## ADR 001: Modular Monorepo Architecture
- **Context**: The blueprint mandates single repository with TypeScript throughout frontend, backend, workers, and realtime service.
- **Decision**: Adopt pnpm workspaces with Turborepo for fast caching and shared dependency management.

## ADR 002: Next.js App Router for Both Web & Admin
- **Context**: Blueprint specifies that public website and admin dashboard share the same codebase.
- **Decision**: Use route groups `app/(public)`, `app/(auth)`, `app/(viewer)`, and `app/admin` with isolated layout hierarchies.

## ADR 003: Video Streaming Engine via SRS + hls.js
- **Context**: Need cost-effective, low-latency live streaming capable of scaling to 50k+ viewers.
- **Decision**: Decouple video delivery from Next.js server. Use SRS as the ingest origin and HLS packaging engine, with hls.js client-side custom player.

## ADR 004: Minor Integer Currency Representation
- **Context**: Avoid float rounding issues in ticketing and virtual gift ledger accounting.
- **Decision**: Store all amounts as integers (e.g. 500 ETB = 50000 santims; $15 = 1500 cents).

## ADR 005: Decoupled Real-time Node Server
- **Context**: Next.js serverless runtimes do not sustain persistent WebSocket connections.
- **Decision**: Implement `apps/realtime` as a dedicated persistent Node.js Socket.IO server connected to the same database and Redis message broker.
