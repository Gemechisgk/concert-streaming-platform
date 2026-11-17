/**
 * Resolves the Socket.IO URL for real-time director and player telemetry.
 * In production or remote deployments, prevents client-side browsers from attempting
 * connections to 'localhost:3001', using the origin host or configured remote endpoint.
 *
 * Returns null when no realtime server is configured for a remote deployment
 * (e.g. Vercel), so clients do not spam failed WebSocket handshakes.
 *
 * NOTE: Production deployment requires realtime server at:
 * - Configured via NEXT_PUBLIC_REALTIME_URL environment variable, OR
 * - Deployed as separate service with reverse proxy at /socket.io path
 */
export function getRealtimeSocketUrl(): string | null {
  const envUrl = process.env.NEXT_PUBLIC_REALTIME_URL;
  const hasRemoteEnvUrl =
    !!envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1');

  if (typeof window === 'undefined') {
    return hasRemoteEnvUrl ? envUrl : 'http://localhost:3001';
  }

  const isLocalhost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0';

  // 1. If explicitly configured with a non-localhost remote URL, use that
  if (hasRemoteEnvUrl) {
    return envUrl;
  }

  // 2. If running on local developer machine, use configured or default port 3001
  if (isLocalhost) {
    return envUrl || `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  // 3. Remote deployment without a realtime sidecar: stay offline instead of
  //    retrying WebSocket upgrades against a host that cannot serve them.
  return null;
}
