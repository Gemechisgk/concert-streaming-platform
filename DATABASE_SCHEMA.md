# Database Schema Architecture

The PostgreSQL schema is managed via Prisma ORM (`prisma/schema.prisma`). All monetary values are represented as 64-bit integers in minor currency units (cents/ETB cents) to eliminate floating-point inaccuracies.

## Entity Modules

### 1. Identity & RBAC
- **users**: ID, email, password_hash, full_name, phone_number, is_active, created_at, updated_at.
- **roles**: ID, name (`SUPER_ADMIN`, `EVENT_ADMIN`, `EVENT_MANAGER`, `FINANCE_MANAGER`, `CUSTOMER_SUPPORT`, `CHAT_MODERATOR`, `VIEWER`), description.
- **user_roles**: user_id, role_id.
- **user_sessions**: id, user_id, token_hash, ip_address, user_agent, expires_at, revoked_at.

### 2. Events & Performers
- **events**: id, title, slug, description, banner_image, thumbnail_image, status (`DRAFT`, `PUBLISHED`, `SCHEDULED`, `LIVE`, `ENDED`, `ARCHIVED`), venue_name, venue_location, start_time, end_time, created_by.
- **event_artists**: id, event_id, name, bio, image_url, social_links.
- **event_schedules**: id, event_id, stage_name, performer_name, start_time, end_time.

### 3. Ticketing & Inventory
- **ticket_types**: id, event_id, name (`Early Bird`, `Standard`, `VIP`, `Premium`, `Complimentary`), price_in_cents, currency (`ETB`, `USD`), capacity, sold_count, max_per_user, sales_start_time, sales_end_time.
- **orders**: id, user_id, order_number, total_amount_cents, currency, status (`PENDING`, `COMPLETED`, `CANCELLED`, `REFUNDED`), idempotency_key, created_at.
- **order_items**: id, order_id, ticket_type_id, quantity, unit_price_cents.
- **tickets**: id, order_id, user_id, ticket_type_id, ticket_code (cryptographic unique hash), qr_code_url, status (`ACTIVE`, `TRANSFERRED`, `REVOKED`), stream_token.

### 4. Payments
- **payment_providers**: id, code (`TELEBIRR`, `CBE_BIRR`, `CHAPA`, `ARIFPAY`, `STRIPE`), is_active.
- **payments**: id, order_id, provider_id, transaction_reference, amount_cents, currency, status (`INITIATED`, `SUCCESSFUL`, `FAILED`, `REFUNDED`), raw_response, created_at.
- **payment_webhooks**: id, provider_id, payload, signature, processed, created_at.

### 5. Streaming Infrastructure
- **stream_channels**: id, event_id, primary_ingest_key, backup_ingest_key, stream_status (`OFFLINE`, `INGESTING`, `BROADCASTING`), srs_session_id.
- **playback_sessions**: id, ticket_id, user_id, stream_channel_id, session_token, ip_address, started_at, last_heartbeat, is_active.
- **stream_recordings**: id, stream_channel_id, vod_url, duration_seconds, status (`RECORDING`, `PROCESSING`, `READY`, `FAILED`).

### 6. Live Chat & Virtual Gifts
- **chat_rooms**: id, event_id, is_locked, slow_mode_seconds.
- **chat_messages**: id, room_id, user_id, message, is_pinned, is_deleted, created_at.
- **gift_catalog**: id, name, icon_url, animation_type, price_coins, price_cents.
- **wallet_accounts**: id, user_id, balance_coins, updated_at.
- **wallet_ledger_entries**: id, wallet_id, type (`CREDIT`, `DEBIT`), amount, reference_id, created_at.
- **gifts_sent**: id, event_id, sender_id, gift_id, count, total_coins, created_at.

### 7. Analytics & System
- **viewer_sessions**: id, event_id, user_id, watch_duration_seconds, peak_bitrate, buffer_health, country_code.
- **audit_logs**: id, user_id, action, resource_type, resource_id, metadata_json, created_at.
