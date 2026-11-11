# System Architecture

## Architecture Overview
The platform uses a modular monolith design pattern with separated concerns across packages and applications within a single monorepo repository.

```
                      +-----------------------------+
                      |   Nginx Reverse Proxy / CDN  |
                      +--------------+--------------+
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+------------------+       +-------------------+       +-------------------+
|  Next.js App     |       | Socket.IO Server  |       | SRS Media Origin  |
|  (Web & Admin)   |       | (Live Chat/Gifts) |       | (RTMP Ingest/HLS) |
+--------+---------+       +---------+---------+       +---------+---------+
         |                           |                           |
         +---------------------------+---------------------------+
                                     |
         +---------------------------+---------------------------+
         |                                                       |
         v                                                       v
+------------------+                                   +-------------------+
|  PostgreSQL 16   |                                   |      Redis 7      |
|  (Prisma ORM)    |                                   | (Cache & BullMQ)  |
+------------------+                                   +---------+---------+
                                                                 |
                                                                 v
                                                       +-------------------+
                                                       | BullMQ Workers    |
                                                       | (Async Tasks)     |
                                                       +-------------------+
```

## Module Separation
1. **apps/web**: Next.js App Router containing public viewer-facing pages, authenticated client dashboard, streaming watch room with hls.js player, and full administrative dashboard.
2. **apps/realtime**: Persistent Node.js Socket.IO server handling live chat rooms, slow mode, word filtering, pinned messages, moderator controls, and virtual gift animations.
3. **apps/workers**: BullMQ job workers processing ticket emails, SMS alerts, video recording packaging, and telemetry aggregation.
4. **packages/business-logic**: Reusable domain services executing all business operations (orders, ticket validation, stream authorization, etc.).
5. **packages/database**: Prisma database access layer with connection management and transactional boundaries.
6. **packages/validation**: Zod schemas shared across frontends, APIs, and services.
7. **packages/types**: Shared TypeScript type definitions.
