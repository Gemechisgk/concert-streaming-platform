// k6 Load Testing Script for 10,000 Concurrent Live Stream Viewers
// Simulates user token issuance, stream authorization, and periodic player heartbeats

import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 2000 },  // Ramp-up to 2,000 viewers
    { duration: '1m', target: 5000 },   // Ramp-up to 5,000 viewers
    { duration: '2m', target: 10000 },  // Peak load: 10,000 simultaneous viewers
    { duration: '1m', target: 10000 },  // Sustain 10,000 viewers
    { duration: '30s', target: 0 },     // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms (Blueprint Criterion 13)
    http_req_failed: ['rate<0.01'],    // Under 1% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const EVENT_ID = 'evt_teddy_afro_01';

export default function () {
  const userId = `vu_${__VU}_${__ITER}`;
  const ticketCode = 'TKT-TED-VIP-0001-9X8K2';

  // 1. Authorize Stream & Obtain Signed Token
  const tokenPayload = JSON.stringify({
    ticketCode,
    eventId: EVENT_ID,
  });

  const tokenRes = http.post(`${BASE_URL}/api/v1/streams/token`, tokenPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(tokenRes, {
    'token response status is 200': (r) => r.status === 200,
    'has signed stream token': (r) => JSON.parse(r.body).token !== undefined,
  });

  const tokenData = tokenRes.json();
  const streamToken = tokenData ? tokenData.token : null;

  if (streamToken) {
    // 2. Simulate Video Player Periodic Heartbeat Loop (Simulating 10,000 continuous viewers)
    for (let i = 0; i < 3; i++) {
      sleep(5); // 5s playback interval

      const heartbeatPayload = JSON.stringify({
        streamToken,
        playbackPositionSeconds: 120 + i * 5,
        bitrateKbps: 4500,
        bufferHealth: 0.99,
        dropFrames: 0,
      });

      const hbRes = http.post(`${BASE_URL}/api/v1/streams/heartbeat`, heartbeatPayload, {
        headers: { 'Content-Type': 'application/json' },
      });

      check(hbRes, {
        'heartbeat recorded active': (r) => r.status === 200,
      });
    }
  }

  sleep(1);
}
