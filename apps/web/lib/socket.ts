/**
 * Resolves the Socket.IO URL for real-time director and player telemetry.
 * In production or remote deployments, prevents client-side browsers from attempting
 * connections to 'localhost:3001', using the origin host or configured remote endpoint.
 * 
 * NOTE: Production deployment requires realtime server at:
 * - Configured via NEXT_PUBLIC_REALTIME_URL environment variable, OR
 * - Deployed as separate service with reverse proxy at /socket.io path
 */
export function getRealtimeSocketUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_REALTIME_URL || 'http://localhost:3001';
  }

  const envUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0';

  // 1. If explicitly configured with a non-localhost remote URL, use that
  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    return envUrl;
  }

  // 2. If running on local developer machine, use configured or default port 3001
  if (isLocalhost) {
    return envUrl || `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  // 3. In production, use same origin with /socket.io path
  // This requires reverse proxy or same-origin deployment
  return `${window.location.origin}`;
}
