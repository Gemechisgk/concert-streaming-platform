# Concert Streaming Platform - Master Development Blueprint

## 1. Project Vision
Build a professional, reusable, branded concert-streaming platform that allows the organization to broadcast live events securely and at scale.

### Core Capabilities
1. Create and manage concerts and live events.
2. Sell digital tickets across multiple tiers (Early Bird, Standard, VIP, Premium, Complimentary).
3. Authenticate ticket holders before granting access.
4. Broadcast concerts from physical venues to global audiences.
5. Automatically deliver different video qualities (ABR HLS) according to viewers' internet connections.
6. Support live chat and real-time audience interaction.
7. Allow viewers to send virtual gifts and tips with animated screen overlays.
8. Record concerts and make replays available via an authenticated VOD library.
9. Manage users, payments, events, gifts, streams, and analytics through an administration dashboard.
10. Reuse the same platform for future concerts without rebuilding the application.

### Main Objective
Designed to eventually support 50,000–75,000 simultaneous viewers via independent SRS origin and CDN distribution.

---

## 2. Technology Stack & Rules
- **Frontend & Backend**: Next.js App Router (TypeScript)
- **Styling & UI**: Tailwind CSS, shadcn/ui principles, Lucide icons
- **Database & ORM**: PostgreSQL + Prisma
- **Cache & Async Jobs**: Redis + BullMQ
- **Real-Time Communication**: Persistent Socket.IO server
- **Streaming Origin**: SRS (Simple Realtime Server) + FFmpeg ABR HLS
- **Browser Playback**: hls.js with custom player controls and failure state overlays
- **Payment Gateways**: Ethiopian (Telebirr, CBE Birr, Chapa, Arifpay) and International (Stripe)
- **Testing**: Vitest, Playwright, k6

---

## 3. Strict Rules & Definition of Done
1. TypeScript strict mode enabled (`"strict": true`). No unchecked `any`.
2. Thin route handlers; domain logic encapsulated in `@concert/business-logic` services.
3. Strict Zod validation on every input and API endpoint.
4. Money stored strictly as integer minor units (cents / Ethiopian cents).
5. Single-stream session policy enforced per ticket entitlement.
6. Up-to-date documentation and `PROGRESS.md` maintained at every step.
