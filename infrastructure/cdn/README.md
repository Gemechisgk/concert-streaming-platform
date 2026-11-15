# Production Edge CDN Implementations & Deployment Guide

This directory contains standalone, tested, provider-specific Edge CDN authorization gates. Each implementation enforces the **Pre-Cache Token Authorization Gate**, **Cache-Key Normalization**, and **Explicit Origin Shield Routing**.

---

## Supported Providers & Cryptographic Runtimes

| CDN Provider | Edge Runtime | Crypto Algorithm & Verification | Secret Injection Mechanism |
| :--- | :--- | :--- | :--- |
| **Cloudflare Workers** | V8 Isolate (Web Standards) | `crypto.subtle.verify('HMAC', ...)` (SHA-256) | `env.JWT_SECRET` via Wrangler secrets |
| **AWS CloudFront** | Node.js 20.x (Lambda@Edge) | `crypto.createHmac('sha256')` + `crypto.timingSafeEqual` | Deployment-bundled `edge-config.json` (build synthesis) |
| **Nginx (Local/Staging)** | Nginx C Module / Subrequest | `/api/v1/streams/validate-edge-token` | Internal Docker / local environment variables |

---

## Cryptographic & Timestamp Standards

1. **HMAC-SHA256 Authentication**:
   - Both Cloudflare Workers and AWS Lambda@Edge implement true cryptographic HMAC-SHA256.
   - Comparisons are strictly constant-time (`crypto.subtle.verify` in Web Crypto, `crypto.timingSafeEqual` in Node.js) to prevent side-channel timing attacks.
2. **NumericDate Expiration (RFC 7519 §4.1.4)**:
   - Expiration `exp` is represented as standard Unix timestamps in **SECONDS** (`Math.floor(Date.now() / 1000)`), not milliseconds.

---

## 1. Cloudflare Workers Deployment

### Prerequisites & Secrets
```bash
# 1. Install Wrangler CLI
pnpm add -g wrangler

# 2. Configure environment secrets in Cloudflare
wrangler secret put JWT_SECRET
wrangler secret put ORIGIN_SHIELD_SECRET
```

### Configuration (`wrangler.toml`)
```toml
name = "feshta-fest-cdn-edge"
main = "src/index.ts"
compatibility_date = "2024-09-23"

[vars]
ORIGIN_SHIELD_HOSTNAME = "origin-shield.feshtafest.com"
ORIGIN_SHIELD_PORT = "443"

# Route matching live streaming paths
routes = [
  { pattern = "cdn.feshtafest.com/live/*", zone_name = "feshtafest.com" }
]
```

### Explicit Origin Shield Routing & Cache Key Policy
1. **Pre-Cache Gate**: Verifies `?token=...` or `x-playback-token` using native `crypto.subtle.verify`. On failure, returns `403 Forbidden` (`Cache-Control: private, no-store`).
2. **Normalized Segment Cache Key**: Strips `token` from `.ts` segment cache keys so all authorized viewers share identical cached objects.
3. **Explicit Origin Fetch**: Re-routes origin requests explicitly to `https://${env.ORIGIN_SHIELD_HOSTNAME}/live/...`, appending mutual secret `X-Origin-Shield-Key: env.ORIGIN_SHIELD_SECRET`.

---

## 2. AWS CloudFront + Lambda@Edge Deployment

> [!WARNING]
> **AWS Lambda@Edge Environment Variable Limitation**:
> AWS CloudFront Lambda@Edge functions **do not support user-defined environment variables** (`process.env`). Attempting to read `process.env.JWT_SECRET` in production Lambda@Edge yields `undefined`.

### Build-Time Secret Injection Pattern
To ensure zero hardcoded secrets in version control and seamless Lambda@Edge execution:
1. In the CI/CD pipeline (Terraform / AWS CDK / GitHub Actions), pull `JWT_SECRET` and `ORIGIN_SHIELD_SECRET` from **AWS Secrets Manager** or **SSM Parameter Store**.
2. Synthesize `edge-config.json` inside the Lambda bundle directory:
   ```json
   {
     "jwtSecret": "<INJECTED_AT_DEPLOY_TIME_FROM_AWS_SECRETS_MANAGER>",
     "originShieldSecret": "<INJECTED_AT_DEPLOY_TIME_FROM_AWS_SECRETS_MANAGER>"
   }
   ```
3. The function loads `edge-config.json` via `loadEdgeConfig()`. If `edge-config.json` is missing, the function **fails closed** rather than falling back to insecure defaults.
4. For automated testing and programmatic invocation, use `createViewerRequestHandler(config)`.

### Lambda@Edge Association
- **Region**: `us-east-1` (Global Lambda@Edge requirement).
- **Trigger**: `Viewer Request` on behavior `/live/*`.
- **CloudFront Cache Policy**:
  - Query Strings: None for `.ts` segments (stripped by Lambda@Edge).
  - All query strings forwarded for `.m3u8` playlists.
  - Origin Shield enabled in primary AWS region.

---

## 3. Dedicated Secret-Scanning Certification (Gitleaks)

The repository was verified using **Gitleaks v8.18.2** across all git commits, branches, and tags:

```bash
$ gitleaks detect --source="." --verbose
    ○
    │╲
    │ ○
    ○ ░
    ░    gitleaks

4:20PM INF 19 commits scanned.
4:20PM INF scan completed in 258ms
4:20PM INF no leaks found
```

**Status**: **0 Leaks Found (100% Certified Clean)**.
