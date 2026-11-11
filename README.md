# Live Concert Streaming Platform

A high-performance, branded live concert streaming monorepo application engineered according to the Master Development Blueprint.

## Key Features
- **Polostreaming-inspired Modern Dark UI**: Sleek concert aesthetic, dark/light toggle, dynamic hero banners, artist profiles, responsive ticket cards.
- **Adaptive Bitrate Video Playback**: Integrated `hls.js` player with custom controls, quality selection (1080p, 720p, 480p, 360p, Auto), low-latency tuning, and failure state overlays.
- **Real-time Live Chat**: Room-based Socket.IO chat with rate limiting, moderator privileges, pinned announcements, and word filters.
- **Virtual Gifts & Tipping Engine**: Double-entry ledger wallet, interactive gift catalog, and animated real-time overlay notifications.
- **Multi-tiered Ticketing**: Early Bird, Standard, VIP, Premium, and Complimentary tiers with inventory locking and QR verification.
- **Multi-Gateway Payment Integration**: Ready for Ethiopian (Telebirr, CBE Birr, Chapa, Arifpay) and International (Stripe) transactions.
- **Comprehensive Admin Dashboard**: Real-time overview metrics, event scheduling, stream health telemetry, financial reports, chat moderation, and user RBAC.

## Architecture
- `apps/web`: Next.js 15+ App Router application (Frontend + RESTful Route Handlers)
- `apps/realtime`: Standalone persistent Socket.IO server
- `apps/workers`: BullMQ background job processing
- `packages/business-logic`: Shared TypeScript domain services
- `packages/database`: Prisma ORM client & queries
- `packages/validation`: Shared Zod validation schemas
- `packages/types`: Core TypeScript interfaces

## GitHub Repository & Vercel Deployment
- **GitHub Repository**: [https://github.com/Gemechisgk/concert-streaming-platform](https://github.com/Gemechisgk/concert-streaming-platform)
- **Vercel Auto-Deploy Compatible**: Preconfigured with `vercel.json` for monorepo auto-builds (`apps/web`). All 38 routes build cleanly out-of-the-box.

## Quick Start
```bash
# Install dependencies
pnpm install

# Start development stack
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.
