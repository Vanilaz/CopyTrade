/**
 * ═══════════════════════════════════════════════════════
 *  Inbound Adapter: WebSocketAdapter
 *  Dashboard real-time WebSocket connections
 * ═══════════════════════════════════════════════════════
 */

import type http from 'node:http';
import type { GetDashboardData } from '../../application/GetDashboardData.js';
import type { DashboardBroadcaster } from '../outbound/DashboardBroadcaster.js';

interface WSServerLike {
  on(event: 'connection', cb: (ws: WSLike, req: http.IncomingMessage) => void): void;
}

interface WSLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: string, cb: (...args: unknown[]) => void): void;
}

export class WebSocketAdapter {
  private wss: WSServerLike | null = null;

  constructor(
    private dashboard: GetDashboardData,
    private broadcaster: DashboardBroadcaster,
    private passcode: string,
  ) {}

  async attach(httpServer: http.Server): Promise<void> {
    try {
      const wsModule = await import('ws');
      const WebSocketServer = wsModule.WebSocketServer || (wsModule as any).Server;
      this.wss = new WebSocketServer({ server: httpServer });

      this.wss!.on('connection', (ws: WSLike, req: http.IncomingMessage) => {
        // Check passcode
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const token = url.searchParams.get('passcode');
        if (this.passcode && token !== this.passcode) {
          ws.close(4001, 'Unauthorized');
          return;
        }

        console.log('[WS] Dashboard client connected');
        this.broadcaster.addWsClient(ws);

        // Send initial state
        const send = (type: string, data: unknown) =>
          ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));

        send('status', this.dashboard.getStatus());
        send('signalHistory', this.dashboard.getSignals(50));
        send('tradeHistory', this.dashboard.getHistory(100));
        send('performance', this.dashboard.getPerformance());
        send('sync', this.dashboard.getSync());
        send('risk', this.dashboard.getRisk());
        send('equityHistory', this.dashboard.getEquityHistory());

        ws.on('close', () => {
          this.broadcaster.removeWsClient(ws);
        });
      });

      console.log('  ║  WebSocket : attached to HTTP server');
    } catch (e) {
      console.warn('[WS] ws package not available:', (e as Error).message);
    }
  }
}
