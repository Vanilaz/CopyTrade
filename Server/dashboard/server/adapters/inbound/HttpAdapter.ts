/**
 * ═══════════════════════════════════════════════════════
 *  Inbound Adapter: HttpAdapter
 *  REST API for Dashboard + EA HTTP transport
 * ═══════════════════════════════════════════════════════
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AuthenticateEA } from '../../application/AuthenticateEA.js';
import type { ProcessHeartbeat } from '../../application/ProcessHeartbeat.js';
import type { ProcessSignal } from '../../application/ProcessSignal.js';
import type { GetDashboardData } from '../../application/GetDashboardData.js';
import type { ResetPerformance } from '../../application/ResetPerformance.js';
import type { IAccountStore } from '../../domain/ports/IAccountStore.js';
import type { PerformanceTracker } from '../../domain/services/PerformanceTracker.js';
import type { DashboardBroadcaster } from '../outbound/DashboardBroadcaster.js';

interface HttpConfig {
  authToken: string;
  dashboardPasscode: string;
}

// ─── Helpers ─────────────────────────────────────────────
function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 65536) { req.destroy(); reject(new Error('Body too large')); }
      chunks.push(c);
    });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString())); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function setCORS(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-EA-ID, X-EA-Role, X-Passcode');
}

function jsonResponse(res: http.ServerResponse, status: number, data: unknown): void {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ─── HTTP Adapter ────────────────────────────────────────
export class HttpAdapter {
  private server: http.Server;

  constructor(
    private auth: AuthenticateEA,
    private heartbeat: ProcessHeartbeat,
    private signal: ProcessSignal,
    private dashboard: GetDashboardData,
    private resetPerf: ResetPerformance,
    private accounts: IAccountStore,
    private perfTracker: PerformanceTracker,
    private broadcaster: DashboardBroadcaster,
    private config: HttpConfig,
    private distDir: string,
  ) {
    this.server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => this.handleRequest(req, res));
  }

  getServer(): http.Server { return this.server; }

  listen(port: number): void {
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`  ║  HTTP Port : ${port} (Dashboard + EA API)`);
      console.log(`  ║  EA API    : http://localhost:${port}/api/ea/`);
    });
  }

  private checkPasscode(req: http.IncomingMessage): boolean {
    if (!this.config.dashboardPasscode) return true;
    const headerCode = req.headers['x-passcode'] as string;
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    const queryCode = url.searchParams.get('passcode');
    return headerCode === this.config.dashboardPasscode || queryCode === this.config.dashboardPasscode;
  }

  private checkEaAuth(req: http.IncomingMessage): boolean {
    if (!this.config.authToken) return true;
    const auth = req.headers['authorization'] || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    return token === this.config.authToken;
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url || '/', `http://${host}`);
    const pathname = url.pathname;

    // ─── CORS Preflight ───
    if (req.method === 'OPTIONS') { setCORS(res); res.writeHead(204); res.end(); return; }

    // ─── Health ───
    if (pathname === '/health' || pathname === '/api/health') {
      return jsonResponse(res, 200, {
        status: 'ok', version: '3.0-clean',
        uptime: process.uptime(),
        masters: this.accounts.masterCount(),
        slaves: this.accounts.slaveCount(),
      });
    }

    // ─── Dashboard APIs ─────────────────────────────────
    if (pathname === '/api/auth_check') {
      return jsonResponse(res, 200, { ok: this.checkPasscode(req) });
    }

    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/ea/')) {
      if (!this.checkPasscode(req)) return jsonResponse(res, 401, { error: 'Unauthorized' });

      switch (pathname) {
        case '/api/status': return jsonResponse(res, 200, this.dashboard.getStatus());
        case '/api/signals': return jsonResponse(res, 200, this.dashboard.getSignals(100));
        case '/api/history': return jsonResponse(res, 200, this.dashboard.getHistory(500));
        case '/api/performance': return jsonResponse(res, 200, this.dashboard.getPerformance());
        case '/api/sync': return jsonResponse(res, 200, this.dashboard.getSync());
        case '/api/equity-history': return jsonResponse(res, 200, this.dashboard.getEquityHistory());
        case '/api/risk': return jsonResponse(res, 200, this.dashboard.getRisk());
        case '/api/positions': return jsonResponse(res, 200, this.dashboard.getPositions());
        case '/api/reset-performance': {
          const acctId = url.searchParams.get('account') || null;
          return jsonResponse(res, 200, this.resetPerf.execute(acctId));
        }
      }
    }

    // ─── SSE ───
    if (pathname === '/api/ea/sse') {
      if (!this.checkPasscode(req)) { res.writeHead(401); res.end('Unauthorized'); return; }
      setCORS(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ type: 'status', data: this.dashboard.getStatus(), timestamp: Date.now() })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'performance', data: this.dashboard.getPerformance(), timestamp: Date.now() })}\n\n`);
      this.broadcaster.addSseClient(res);
      req.on('close', () => this.broadcaster.removeSseClient(res));
      return;
    }

    // ─── EA HTTP APIs ───────────────────────────────────
    if (pathname === '/api/ea/auth' && req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const result = this.auth.execute({
          id: body.id as string,
          role: body.role as 'master' | 'slave',
          token: body.token as string,
          transport: 'http',
        });
        if (!result.ok) return jsonResponse(res, 401, { ok: false, error: result.error });
        this.broadcaster.broadcast('status', this.dashboard.getStatus());
        return jsonResponse(res, 200, { ok: true, id: body.id, role: body.role, transport: 'http' });
      } catch (e: unknown) {
        return jsonResponse(res, 500, { ok: false, error: (e as Error).message });
      }
    }

    if (pathname === '/api/ea/heartbeat' && req.method === 'POST') {
      if (!this.checkEaAuth(req)) return jsonResponse(res, 401, { ok: false, error: 'Unauthorized' });
      try {
        const body = await parseBody(req);
        this.heartbeat.execute(body.id as string, (body.role || 'unknown') as string, {
          balance: body.balance as number, equity: body.equity as number,
          marginLevel: body.marginLevel as number, marginUsed: body.marginUsed as number,
          freeMargin: body.freeMargin as number, floatingPnL: body.floatingPnL as number,
          positions: body.positions as number, positionDetails: body.positionDetails as any[],
          cumulativeDW: body.cumulativeDW as number,
        });
        return jsonResponse(res, 200, { ok: true, ts: Date.now() });
      } catch (e: unknown) {
        return jsonResponse(res, 500, { ok: false, error: (e as Error).message });
      }
    }

    if (pathname === '/api/ea/signal' && req.method === 'POST') {
      if (!this.checkEaAuth(req)) return jsonResponse(res, 401, { ok: false, error: 'Unauthorized' });
      try {
        const msg = await parseBody(req);
        const masterID = (msg.mid || msg.id || '') as string;
        if (!masterID) return jsonResponse(res, 400, { ok: false, error: 'Missing master ID' });
        const { routed, seq } = this.signal.execute(masterID, msg as any);
        return jsonResponse(res, 200, { ok: true, routed, seq });
      } catch (e: unknown) {
        return jsonResponse(res, 500, { ok: false, error: (e as Error).message });
      }
    }

    if (pathname === '/api/ea/poll' && req.method === 'GET') {
      if (!this.checkEaAuth(req)) return jsonResponse(res, 401, { ok: false, error: 'Unauthorized' });
      const slaveId = url.searchParams.get('id');
      if (!slaveId) return jsonResponse(res, 400, { ok: false, error: 'Missing slave id' });
      const slave = this.accounts.getSlave(slaveId);
      if (!slave) return jsonResponse(res, 404, { ok: false, error: 'Slave not registered' });
      const signals = [...slave.pendingSignals];
      slave.pendingSignals = [];
      slave.lastHeartbeat = Date.now();
      return jsonResponse(res, 200, { ok: true, signals, count: signals.length });
    }

    if (pathname === '/api/ea/subscribe' && req.method === 'POST') {
      if (!this.checkEaAuth(req)) return jsonResponse(res, 401, { ok: false, error: 'Unauthorized' });
      try {
        const body = await parseBody(req);
        const slaveID = body.slaveID as string;
        if (!slaveID) return jsonResponse(res, 400, { ok: false, error: 'Missing slaveID' });
        const slave = this.accounts.getSlave(slaveID);
        if (slave) {
          slave.subscribedTo = (body.masterID || '') as string;
          this.broadcaster.broadcast('status', this.dashboard.getStatus());
        }
        return jsonResponse(res, 200, { ok: true });
      } catch (e: unknown) {
        return jsonResponse(res, 500, { ok: false, error: (e as Error).message });
      }
    }

    // ─── Serve React Dashboard (dist/) ──────────────────
    const servePath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.resolve(this.distDir, '.' + servePath);

    if (!filePath.startsWith(this.distDir)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }

    const contentTypes: Record<string, string> = {
      '.html': 'text/html', '.css': 'text/css',
      '.js': 'application/javascript', '.json': 'application/json',
      '.png': 'image/png', '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
    };

    fs.readFile(filePath, (err: NodeJS.ErrnoException | null, data: Buffer) => {
      if (!err) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
        res.end(data);
        return;
      }
      // SPA fallback
      fs.readFile(path.join(this.distDir, 'index.html'), (err2: NodeJS.ErrnoException | null, indexData: Buffer) => {
        if (err2) { res.writeHead(404); res.end('Not Found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexData);
      });
    });
  }
}
