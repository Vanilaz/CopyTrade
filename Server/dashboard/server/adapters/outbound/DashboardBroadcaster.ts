/**
 * ═══════════════════════════════════════════════════════
 *  Outbound Adapter: DashboardBroadcaster
 *  Implements IBroadcaster — sends to WebSocket + SSE
 * ═══════════════════════════════════════════════════════
 */

import type { IBroadcaster } from '../../domain/ports/IBroadcaster.js';
import type { ServerResponse } from 'node:http';

interface WSLike {
  readyState: number;
  send(data: string): void;
}

export class DashboardBroadcaster implements IBroadcaster {
  private wsClients: WSLike[] = [];
  private sseClients: ServerResponse[] = [];

  broadcast(type: string, data: unknown): void {
    let msg: string;
    try {
      msg = JSON.stringify({ type, data, timestamp: Date.now() });
    } catch (e) {
      console.error(`[Broadcaster] JSON.stringify failed for "${type}":`, (e as Error).message);
      return;
    }

    // WebSocket
    this.wsClients = this.wsClients.filter(ws => {
      try {
        if (ws.readyState === 1) { ws.send(msg); return true; }
        return false;
      } catch { return false; }
    });

    // SSE
    if (this.sseClients.length > 0) {
      const sseMsg = `data: ${msg}\n\n`;
      this.sseClients = this.sseClients.filter(res => {
        try { res.write(sseMsg); return true; } catch { return false; }
      });
    }
  }

  addWsClient(ws: WSLike): void {
    this.wsClients.push(ws);
  }

  removeWsClient(ws: WSLike): void {
    this.wsClients = this.wsClients.filter(c => c !== ws);
  }

  addSseClient(res: ServerResponse): void {
    this.sseClients.push(res);
  }

  removeSseClient(res: ServerResponse): void {
    this.sseClients = this.sseClients.filter(c => c !== res);
  }

  get wsCount(): number { return this.wsClients.length; }
  get sseCount(): number { return this.sseClients.length; }
}
