# Deployment & Scaling Guide (50,000 Concurrent Viewers)

## Prerequisites
- Node.js >= 20.x, pnpm >= 9.x
- Docker & Docker Compose
- PostgreSQL 16 (or managed PostgreSQL with connection pooling / PgBouncer)
- Redis 7 (or managed Redis / Redis Cluster)
- Pinned SRS (Simple Realtime Server) 8.0-d3 (Build 8.0.74) or Cloudflare Stream

---

## 1. Local & Staging Rehearsal Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Install Pinned SRS Media Server (with SHA-256 Checksum Verification)
powershell -ExecutionPolicy Bypass -File infrastructure/srs/install_srs.ps1

# 3. Apply database schema & seed staging concert data
pnpm db:push
pnpm db:seed

# 4. Run full integration & security test suite
pnpm test

# 5. Start development servers
pnpm dev
```

---

## 2. SRS Media Origin Installation & Pinned Checksum

To guarantee reproducible and secure builds, the media origin server is strictly pinned:
- **Pinned Version**: `SRS-Windows-x86_64-8.0-d3` (Build 8.0.74) / Docker `ossrs/srs:8`
- **Release Source**: [ossrs/srs-windows GitHub Releases](https://github.com/ossrs/srs-windows/releases/tag/v8.0-d3)
- **SHA-256 Checksum**: `85a1a1f0a28f86dcbe8cf0f95844498ec5611ceb6ff2f18375e076326757b3bf`
- **Installation Automation**: Automated via [infrastructure/srs/install_srs.ps1](file:///C:/Users/kk/Desktop/streaming/infrastructure/srs/install_srs.ps1).

> [!CAUTION]
> **TLS & Key Hygiene**:
> - Never check TLS private keys (`*.key`) into Git.
> - Upstream OSSRS demo development certificates are excluded via `.gitignore`.
> - Production TLS certificates must be provisioned externally via Let's Encrypt or Cloudflare Universal SSL.

---

## 3. External CDN Architecture vs. Local Nginx Reverse Proxy

To avoid architectural conflation, our deployment topology distinguishes between:
1. **Local Rehearsal Proxy (Nginx)**: Runs in Docker Compose for local end-to-end integration testing and simulated edge caching.
2. **Production External CDN (Cloudflare Workers)**: Multi-region Edge CDN with 300+ PoPs handling the 125 Gbps aggregate viewer egress.

### External Edge CDN Auth-Before-Cache Architecture

A critical vulnerability in streaming CDNs is inadvertently serving cached segments to unauthorized requesters when authorization occurs independently of cache lookup. Our Edge CDN follows a strict 3-step pipeline:

```
[ Viewer Client ]
       |
       | GET /live/abr/stream_1080p0.ts?token=<SIGNED_TOKEN>
       v
[ External CDN Edge (Cloudflare Worker) ]
       |
       |-- STEP 1: Verify Asymmetric / HMAC Signature of ?token=...
       |   |-- Invalid / Missing / Expired -> RETURN HTTP 403 Forbidden
       |       Headers: Cache-Control: private, no-store, max-age=0
       |       (Execution terminates immediately; cache is never touched)
       |
       +-- STEP 2: Authorized Request -> Normalize Cache Key
       |   Cache Key = "https://cdn.feshtafest.com/live/abr/stream_1080p0.ts"
       |   (Query string ?token=... stripped from segment cache key)
       |
       +-- STEP 3: Check Edge Cache
           |-- Cache HIT  -> Return cached .ts segment immediately (< 15 ms)
           +-- Cache MISS -> Fetch from Origin Shield with X-Origin-Shield secret
```

### Production Edge Worker Implementation Recipe (Cloudflare Workers / Fastly Compute)

```javascript
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || request.headers.get("x-playback-token");

    // 1. Mandatory Pre-Cache Edge Gate
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing stream token" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
      });
    }

    const authCheck = await verifyEdgeToken(token, env.JWT_SECRET);
    if (!authCheck.valid) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid or expired token" }), {
        status: 403,
        headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" }
      });
    }

    // 2. Normalized Segment Cache Key (Token stripped)
    const normalizedUrl = new URL(request.url);
    if (normalizedUrl.pathname.endsWith(".ts") || normalizedUrl.pathname.endsWith(".m4s")) {
      normalizedUrl.search = ""; // Strip token so all authorized viewers share the cached segment
    }

    const cacheKey = new Request(normalizedUrl.toString(), request);
    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (!response) {
      // 3. Direct Origin Shield Request (Protected with Mutual Secret)
      const originRequest = new Request(request.url, {
        headers: {
          ...Object.fromEntries(request.headers),
          "X-Origin-Shield-Key": env.ORIGIN_SHIELD_SECRET
        }
      });
      response = await fetch(originRequest);
      if (response.ok && (url.pathname.endsWith(".ts") || url.pathname.endsWith(".m4s"))) {
        const cacheResponse = response.clone();
        await cache.put(cacheKey, cacheResponse);
      }
    }

    return response;
  }
};
```

---

## 4. Direct-Origin Shielding & Security

To prevent malicious users from bypassing the token-gated CDN and querying the SRS media origin directly:
1. **Network Layer**: SRS Origin HTTP servers (ports 8080 and 8081) and RTMP (port 1935) are deployed inside a Private VPC subnet with zero public internet routing.
2. **Origin Shield Header Verification**: The origin web tier verifies that incoming requests contain `X-Origin-Shield-Key: <SECRET>` matching the CDN configuration. Direct unauthenticated internet requests to origin IPs are rejected with HTTP 403.

---

## 5. Capacity Projection & Measured Rehearsal Results

| Metric | Measured Rehearsal Reality | Projected 50,000-Viewer Concert Target |
| :--- | :--- | :--- |
| **Pipeline Verification** | OBS → SRS → FFmpeg ABR → Next.js CDN Edge Gate | Global Cloudflare Edge PoPs (300+ Cities) |
| **Ingest Handover** | Active primary cut with 0 token dropouts | Dual bonded cellular + fiber RTMP/SRT uplinks |
| **Edge Hit Ratio** | 100% token gate enforcement on cached segments | **$> 99.5\%$** target (reduces 125 Gbps to $< 625$ Mbps origin) |
| **Origin Redundancy** | Dual-origin pool (:8080 primary + :8081 standby) | Multi-AZ active-standby origin clusters |
| **Token Auth Latency** | Sub-millisecond HMAC verification ($< 0.1\text{ ms}$) | Cloudflare Worker ($< 5\text{ ms}$) |

---

## 6. Database & Redis Queue / Cache Topology

### A. PostgreSQL 16 (Relational Ledger & Orders)
- **Sizing**: Min 4 vCPU, 16 GB RAM with PgBouncer connection pooling (max 200 server connections).
- **Workload**: Transactional ticket purchases, order checkout, double-entry gift ledger records, and user authentication.

### B. Redis Realtime & Cache Tier (Ephemeral)
- **Purpose**: Socket.IO Redis Adapter for live chat room broadcasts, transient session caches, and rate-limiting counters.
- **Eviction Policy**: `maxmemory-policy: volatile-lru`.
- **Cluster**: 3-node primary/replica Redis cluster.

### C. Redis BullMQ Queue Tier (Dedicated & Persistent — NO EVICTION)
> [!IMPORTANT]
> **BullMQ strictly requires `noeviction`**: If Redis evicts keys used by BullMQ under memory pressure, queue jobs, locks, and task trees will be permanently lost or corrupted.
- **Instance**: Dedicated Redis 7 instance separated from cache/pubsub workloads.
- **Eviction Policy**: `maxmemory-policy: noeviction`.
- **Persistence**: `appendonly yes` with `appendfsync everysec` to guarantee queue durability across restarts.
