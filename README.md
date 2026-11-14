# Feshta Fest — Live Concert Streaming Platform

A high-performance, branded live concert streaming monorepo application engineered for massive scale (50,000+ concurrent viewers), featuring headline artist **Veronica Adane Live at Feshta Fest**.

## Key Features
- **Feshta Fest Branded UI**: Modern festival aesthetic, dark/light theme, dynamic animated hero reveal, artist showcases, and touch-optimized mobile experience.
- **Adaptive Dual-Mode Video Playback**: Integrated YouTube Live concert embed ([`mSrVwIRKASI`](https://www.youtube.com/watch?v=mSrVwIRKASI)) and low-latency `hls.js` player with custom controls, ABR quality selection (1080p, 720p, 480p, Auto), and failure-recovery overlays.
- **Engineered for 50k Concurrency**: Jittered client heartbeats, $O(1)$ duplicate credential eviction, edge CDN caching headers, and pre-compiled regex chat moderation tested up to 367,000+ pulses/sec.
- **Real-time Live Chat**: Room-based chat with rate limiting, moderator privileges, pinned stage announcements, one-tap emoji cheers, and client-side message windowing.
- **Virtual Gifts & Tipping Engine**: Double-entry ledger wallet, interactive gift catalog, and animated real-time overlay notifications.
- **Multi-tiered Ticketing**: Early Bird, Standard, VIP, and Backstage passes with inventory locking and QR verification (50,000 capacity per event).
- **Multi-Gateway Payment Integration**: Ready for Ethiopian (Telebirr, CBE Birr, Chapa, Arifpay) and International (Stripe) transactions with integer-cents accounting.
- **Comprehensive Admin Dashboard**: Real-time overview metrics, event scheduling, stream health telemetry, financial reports, chat moderation, and user RBAC.

## Architecture
- `apps/web`: Next.js 16+ App Router application (Frontend + RESTful Route Handlers)
- `apps/realtime`: Standalone persistent Socket.IO server with Redis adapter
- `apps/workers`: BullMQ background job processing
- `packages/business-logic`: Shared TypeScript domain services
- `packages/database`: Prisma ORM client & queries
- `packages/validation`: Shared Zod validation schemas
- `packages/types`: Core TypeScript interfaces
- `tests/load`: 50,000 concurrent viewer load simulation test suite

## GitHub Repository & Vercel Deployment
- **GitHub Repository**: [https://github.com/Gemechisgk/concert-streaming-platform](https://github.com/Gemechisgk/concert-streaming-platform)
- **Vercel Auto-Deploy Compatible**: Preconfigured with `vercel.json` for monorepo auto-builds (`apps/web`). All routes build cleanly out-of-the-box.

## Quick Start
```bash
# 1. Install dependencies
pnpm install

# 2. Run unit & integration tests
pnpm test

# 3. Run 50,000 viewer load test
pnpm test:load:50k

# 4. Start development stack
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.
