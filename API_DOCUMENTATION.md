# API Documentation

Versioned RESTful Route Handlers under `/api/v1/*`. All requests and responses are strictly typed and validated using Zod schemas.

## Endpoint Reference

### Authentication
- `POST /api/v1/auth/register` - Create viewer account
- `POST /api/v1/auth/login` - Authenticate credentials and establish session
- `POST /api/v1/auth/logout` - Revoke current user session
- `GET /api/v1/auth/me` - Retrieve current authenticated profile and active tickets

### Events
- `GET /api/v1/events` - List published and live concert events with filtering
- `GET /api/v1/events/[slug]` - Retrieve event details, schedules, performers, and ticket tiers
- `POST /api/v1/admin/events` - Create concert event (Admin/Manager role required)
- `PATCH /api/v1/admin/events/[id]` - Update event details or change lifecycle status (`LIVE`, `ENDED`, etc.)

### Tickets & Orders
- `GET /api/v1/tickets/available?eventId=[id]` - Check real-time ticket availability
- `POST /api/v1/orders/checkout` - Create order with optimistic concurrency and inventory lock
- `GET /api/v1/orders/[orderId]` - Get order details and payment status

### Payments
- `POST /api/v1/payments/initialize` - Initialize payment gateway session (Telebirr, CBE Birr, Chapa, Stripe)
- `POST /api/v1/payments/webhook/[provider]` - Secure webhook callback listener with HMAC signature verification

### Live Streaming & Player
- `POST /api/v1/streams/token` - Request signed single-session playback token for a valid ticket
- `GET /api/v1/streams/[eventId]/manifest` - Fetch stream manifest metadata and ABR URLs
- `POST /api/v1/streams/heartbeat` - Live player heartbeat to enforce single-viewer concurrency

### SRS Media Server Webhooks
- `POST /api/v1/stream-hooks/publish` - Ingest authentication for RTMP push
- `POST /api/v1/stream-hooks/unpublish` - Handle stream termination
- `POST /api/v1/stream-hooks/play` - Viewer entitlement authorization check
- `POST /api/v1/stream-hooks/stop` - Playback disconnection notification

### Live Chat & Interactivity
- `GET /api/v1/chat/[eventId]/history` - Fetch recent room message history
- `POST /api/v1/chat/[eventId]/message` - Send moderated chat message
- `POST /api/v1/chat/moderation/ban` - Moderator ban/mute user
- `POST /api/v1/chat/moderation/pin` - Moderator pin message

### Virtual Gifts & Tipping
- `GET /api/v1/gifts/catalog` - Fetch available virtual gifts
- `POST /api/v1/gifts/send` - Send gift with double-entry ledger deduction and broadcast animation

### Replay & VOD
- `GET /api/v1/replays` - Fetch list of past concert replays available for user's entitlements
- `GET /api/v1/replays/[id]/manifest` - Authenticated VOD manifest access
