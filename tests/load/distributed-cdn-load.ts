import http from 'node:http';
import https from 'node:https';
import { performance } from 'node:perf_hooks';

/**
 * Distributed CDN Edge & Multi-Camera Load Testing Harness
 *
 * Designed to execute distributed HTTP load tests against deployed
 * Cloudflare Worker / CDN origin endpoints and real SRS media servers.
 *
 * Usage:
 *   npx tsx tests/load/distributed-cdn-load.ts
 *
 * Parameters (via Environment Variables):
 *   TARGET_URL     - Base URL (Default: http://localhost:3000)
 *   CONCURRENCY    - Concurrent virtual users (Default: 500)
 *   DURATION_SEC   - Duration of load test in seconds (Default: 10)
 *   EVENT_ID       - Concert event to test (Default: evt_veronica_01)
 *   TICKET_CODE    - Valid rehearsal ticket code (Default: TKT-VER-VIP-0001-TEST1)
 */

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const CONCURRENCY = parseInt(process.env.CONCURRENCY || '250', 10);
const DURATION_SEC = parseInt(process.env.DURATION_SEC || '5', 10);
const EVENT_ID = process.env.EVENT_ID || 'evt_veronica_01';
const TICKET_CODE = process.env.TICKET_CODE || 'TKT-VER-VIP-0001-TEST1';

interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  latencies: number[];
  statusCodes: Record<number, number>;
}

const metrics: RequestMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  latencies: [],
  statusCodes: {}
};

async function makeRequest(urlStr: string, options: { method: string; headers?: Record<string, string>; body?: string }): Promise<{ statusCode: number; durationMs: number }> {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      url,
      {
        method: options.method,
        headers: options.headers || {}
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          const durationMs = performance.now() - t0;
          resolve({ statusCode: res.statusCode || 0, durationMs });
        });
      }
    );

    req.on('error', () => {
      const durationMs = performance.now() - t0;
      resolve({ statusCode: 0, durationMs });
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runWorker(workerId: number, stopTime: number) {
  let sessionToken: string | undefined;

  // Login worker to obtain session token
  try {
    const loginRes = await makeRequest(`${TARGET_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `worker_${workerId}@feshtafest.com`,
        password: 'Viewer@1234'
      })
    });
    // In demo environment, cookie or session is initialized
  } catch {}

  while (Date.now() < stopTime) {
    // 1. Fetch public cameras for event
    const camRes = await makeRequest(`${TARGET_URL}/api/v1/cameras?eventId=${EVENT_ID}`, {
      method: 'GET'
    });
    recordMetric(camRes.statusCode, camRes.durationMs);

    // 2. Request stream authorization token
    const tokenRes = await makeRequest(`${TARGET_URL}/api/v1/streams/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketCode: TICKET_CODE,
        eventId: EVENT_ID
      })
    });
    recordMetric(tokenRes.statusCode, tokenRes.durationMs);

    // 3. Switch camera angle
    const switchRes = await makeRequest(`${TARGET_URL}/api/v1/streams/switch-camera`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketCode: TICKET_CODE,
        eventId: EVENT_ID,
        cameraId: `cam_${EVENT_ID}_2`
      })
    });
    recordMetric(switchRes.statusCode, switchRes.durationMs);

    // Sleep 100ms between loop iterations
    await new Promise((r) => setTimeout(r, 100));
  }
}

function recordMetric(statusCode: number, latencyMs: number) {
  metrics.totalRequests++;
  if (statusCode >= 200 && statusCode < 400) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }
  metrics.latencies.push(latencyMs);
  metrics.statusCodes[statusCode] = (metrics.statusCodes[statusCode] || 0) + 1;
}

function calculatePercentile(latencies: number[], p: number): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.min(idx, sorted.length - 1)];
}

async function main() {
  console.log('================================================================================');
  console.log('FESHTA FEST LIVE PLATFORM â€” DISTRIBUTED CDN & MULTI-CAMERA LOAD TEST HARNESS');
  console.log('================================================================================');
  console.log(`Target Base URL:   ${TARGET_URL}`);
  console.log(`Concurrency:       ${CONCURRENCY} Virtual Users`);
  console.log(`Test Duration:     ${DURATION_SEC} Seconds`);
  console.log(`Target Event:      ${EVENT_ID}`);
  console.log('--------------------------------------------------------------------------------');

  const startTime = Date.now();
  const stopTime = startTime + DURATION_SEC * 1000;

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => runWorker(i + 1, stopTime));
  await Promise.all(workers);

  const totalTimeSec = (Date.now() - startTime) / 1000;
  const rps = (metrics.totalRequests / totalTimeSec).toFixed(1);
  const p50 = calculatePercentile(metrics.latencies, 50).toFixed(2);
  const p95 = calculatePercentile(metrics.latencies, 95).toFixed(2);
  const p99 = calculatePercentile(metrics.latencies, 99).toFixed(2);

  console.log('\n================================================================================');
  console.log('LOAD TEST RESULTS SUMMARY:');
  console.log('================================================================================');
  console.log(`Total HTTP Requests:      ${metrics.totalRequests.toLocaleString()}`);
  console.log(`Successful (2xx/3xx):     ${metrics.successfulRequests.toLocaleString()} (${((metrics.successfulRequests / (metrics.totalRequests || 1)) * 100).toFixed(1)}%)`);
  console.log(`Failed / Errors:          ${metrics.failedRequests.toLocaleString()}`);
  console.log(`Throughput:               ${rps} Requests/Second`);
  console.log(`Latency p50:              ${p50} ms`);
  console.log(`Latency p95:              ${p95} ms`);
  console.log(`Latency p99:              ${p99} ms`);
  console.log('Status Code Distribution:', JSON.stringify(metrics.statusCodes, null, 2));

  console.log('\n--------------------------------------------------------------------------------');
  console.log('PRODUCTION 50,000 CONCURRENT VIEWER DEPLOYMENT REQUIREMENTS & GAP AUDIT:');
  console.log('--------------------------------------------------------------------------------');
  console.log('1. Physical Edge Delivery: Real 50,000 video viewers require ~150-225 Gbps CDN egress.');
  console.log('   This cannot be generated or validated on a single local development machine.');
  console.log('2. Origin Decoupling: Ingestion & Transcoding ($O(K)$) are fully decoupled from Edge delivery ($O(N)$).');
  console.log('   SRS origin only receives 1 pull per variant stream (16 streams = ~72 Mbps).');
  console.log('3. CDN Edge Verification: Must deploy Cloudflare Worker to staging and execute distributed');
  console.log('   load injection using a multi-node cluster (e.g. k6 Cloud or AWS distributed Locust) to verify');
  console.log('   real edge cache hit ratios (â‰¥99.2%) and global ISP routing performance under load.');
  console.log('================================================================================\n');
}

main().catch(console.error);
