import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import crypto from 'node:crypto';
import { ObsSwitcherService } from '../../packages/business-logic/src/obs-switcher.service';

/**
 * Real OBS WebSocket v5 Protocol Integration Test
 *
 * Runs an actual WebSocket server to verify:
 * 1. Op 0 Hello with SHA256 challenge-response authentication.
 * 2. Op 1 Identify and Op 2 Identified lifecycle.
 * 3. Never reports connected if socket is unreachable or disconnected.
 * 4. Dispatches Op 6 SetCurrentProgramScene and verifies Op 7 RequestResponse.
 * 5. Verifies scene updates and streaming status.
 */
describe('Real OBS WebSocket v5 Integration & Protocol Handshake', () => {
  let server: http.Server;
  let testPort: number;
  const testPassword = 'test_obs_secure_password_123';
  const testSalt = crypto.randomBytes(16).toString('base64');
  const testChallenge = crypto.randomBytes(16).toString('base64');

  let currentProgramScene = 'Camera 1: Main Stage';
  let clientIdentified = false;
  let sockets: any[] = [];

  before(async () => {
    // Spin up an actual WebSocket server implementing OBS WebSocket v5 wire protocol
    server = http.createServer();

    server.on('upgrade', (req, socket, head) => {
      sockets.push(socket);

      // Perform standard WebSocket server handshake (RFC 6455)
      const secWebSocketKey = req.headers['sec-websocket-key'];
      const hash = crypto
        .createHash('sha1')
        .update(secWebSocketKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64');

      const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${hash}`
      ];

      socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

      // Helper to send WebSocket text frame
      const sendFrame = (payloadStr: string) => {
        const payloadBuf = Buffer.from(payloadStr);
        const length = payloadBuf.length;
        let header: Buffer;

        if (length < 126) {
          header = Buffer.from([0x81, length]);
        } else if (length < 65536) {
          header = Buffer.from([0x81, 126, (length >> 8) & 0xff, length & 0xff]);
        } else {
          header = Buffer.alloc(10);
          header[0] = 0x81;
          header[1] = 127;
          header.writeBigUInt64BE(BigInt(length), 2);
        }
        socket.write(Buffer.concat([header, payloadBuf]));
      };

      // OBS sends Op 0 (Hello) immediately on connection
      const helloMessage = {
        op: 0,
        d: {
          obsWebSocketVersion: '5.5.0',
          rpcVersion: 1,
          authentication: {
            challenge: testChallenge,
            salt: testSalt
          }
        }
      };
      sendFrame(JSON.stringify(helloMessage));

      // Unmasking frame reader for test server supporting extended payloads (RFC 6455)
      socket.on('data', (data) => {
        try {
          if (data.length < 2) return;
          const lengthIndicator = data[1] & 0x7f;
          let maskOffset = 2;
          if (lengthIndicator === 126) {
            maskOffset = 4;
          } else if (lengthIndicator === 127) {
            maskOffset = 10;
          }

          if (data.length < maskOffset + 4) return;
          const mask = data.slice(maskOffset, maskOffset + 4);
          const maskedPayload = data.slice(maskOffset + 4);
          const unmasked = Buffer.alloc(maskedPayload.length);
          for (let i = 0; i < maskedPayload.length; i++) {
            unmasked[i] = maskedPayload[i] ^ mask[i % 4];
          }

          const msg = JSON.parse(unmasked.toString('utf-8'));
          const { op, d } = msg;

          if (op === 1) {
            // Op 1: Identify from client. Verify SHA256 auth response
            const secretHash = crypto
              .createHash('sha256')
              .update(testPassword + testSalt)
              .digest('base64');
            const expectedAuth = crypto
              .createHash('sha256')
              .update(secretHash + testChallenge)
              .digest('base64');

            if (d.authentication === expectedAuth) {
              clientIdentified = true;
              sendFrame(
                JSON.stringify({
                  op: 2,
                  d: { negotiatedRpcVersion: 1 }
                })
              );
            } else {
              socket.destroy();
            }
          } else if (op === 6) {
            // Op 6: Request
            if (d.requestType === 'GetSceneList') {
              sendFrame(
                JSON.stringify({
                  op: 7,
                  d: {
                    requestType: 'GetSceneList',
                    requestId: d.requestId,
                    requestStatus: { result: true, code: 100 },
                    responseData: {
                      currentProgramSceneName: currentProgramScene,
                      currentPreviewSceneName: 'Camera 2: Front Close-up',
                      scenes: [
                        { sceneName: 'Camera 1: Main Stage', sceneIndex: 0 },
                        { sceneName: 'Camera 2: Front Close-up', sceneIndex: 1 },
                        { sceneName: 'Camera 3: Side Stage', sceneIndex: 2 },
                        { sceneName: 'Camera 4: Audience', sceneIndex: 3 }
                      ]
                    }
                  }
                })
              );
            } else if (d.requestType === 'GetStreamStatus') {
              sendFrame(
                JSON.stringify({
                  op: 7,
                  d: {
                    requestType: 'GetStreamStatus',
                    requestId: d.requestId,
                    requestStatus: { result: true, code: 100 },
                    responseData: {
                      outputActive: true,
                      outputReconnecting: false,
                      outputTimecode: '01:23:45.678'
                    }
                  }
                })
              );
            } else if (d.requestType === 'SetCurrentProgramScene') {
              currentProgramScene = d.requestData.sceneName;
              sendFrame(
                JSON.stringify({
                  op: 7,
                  d: {
                    requestType: 'SetCurrentProgramScene',
                    requestId: d.requestId,
                    requestStatus: { result: true, code: 100 },
                    responseData: {}
                  }
                })
              );
              // Also send Op 5 Event
              sendFrame(
                JSON.stringify({
                  op: 5,
                  d: {
                    eventType: 'CurrentProgramSceneChanged',
                    eventData: { sceneName: currentProgramScene }
                  }
                })
              );
            }
          }
        } catch {
          // ignore parsing error in test server
        }
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        testPort = (server.address() as any).port;
        resolve();
      });
    });
  });

  after(async () => {
    ObsSwitcherService.disconnect();
    for (const s of sockets) {
      try {
        s.destroy();
      } catch {}
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('1. Never reports OBS as connected unless an actual WebSocket connection is established', () => {
    ObsSwitcherService.disconnect();
    const status = ObsSwitcherService.getStatus();
    assert.strictEqual(status.connected, false, 'Must report connected: false when disconnected');
  });

  test('2. Fails to connect if configured OBS host/port is unreachable', async () => {
    ObsSwitcherService.configure({
      host: '127.0.0.1',
      port: 59999, // Unused port
      password: testPassword,
      requestTimeoutMs: 1000
    });

    const connected = await ObsSwitcherService.connect();
    assert.strictEqual(connected, false, 'Must return false when host is unreachable');
    assert.strictEqual(ObsSwitcherService.getStatus().connected, false);
  });

  test('3. Connects and authenticates against real OBS WebSocket v5 challenge-response protocol', async () => {
    ObsSwitcherService.configure({
      host: '127.0.0.1',
      port: testPort,
      password: testPassword,
      requestTimeoutMs: 3000
    });

    const connected = await ObsSwitcherService.connect();
    assert.strictEqual(connected, true, 'Must successfully connect and authenticate');
    assert.strictEqual(clientIdentified, true, 'Server must verify SHA256 challenge-response');

    const status = ObsSwitcherService.getStatus();
    assert.strictEqual(status.connected, true);
    assert.strictEqual(status.isStreaming, true);
    assert.strictEqual(status.currentProgramScene, 'Camera 1: Main Stage');
    assert.ok(status.scenes.length >= 4, 'Must receive scene list from OBS');
  });

  test('4. Issues SetCurrentProgramScene request and verifies resulting scene cut', async () => {
    const cutResult = await ObsSwitcherService.switchProgramScene('Camera 3: Side Stage');
    assert.strictEqual(cutResult.success, true);
    assert.strictEqual(cutResult.sceneName, 'Camera 3: Side Stage');
    assert.ok(cutResult.latencyMs >= 0);

    const status = ObsSwitcherService.getStatus();
    assert.strictEqual(status.currentProgramScene, 'Camera 3: Side Stage', 'Program scene must be updated');
    assert.strictEqual(currentProgramScene, 'Camera 3: Side Stage', 'Physical OBS mixer must cut to target scene');
  });

  test('5. Disconnects cleanly and immediately updates connection status', () => {
    ObsSwitcherService.disconnect();
    const status = ObsSwitcherService.getStatus();
    assert.strictEqual(status.connected, false, 'Must immediately report connected: false upon disconnect');
  });
});
