/**
 * ═══════════════════════════════════════════════════════
 *  Inbound Adapter: TcpAdapter
 *  TCP server with length-prefixed protocol for EAs
 * ═══════════════════════════════════════════════════════
 */

import net from 'node:net';
import type { AuthenticateEA } from '../../application/AuthenticateEA.js';
import type { ProcessHeartbeat } from '../../application/ProcessHeartbeat.js';
import type { ProcessSignal, SignalSender } from '../../application/ProcessSignal.js';
import type { GetDashboardData } from '../../application/GetDashboardData.js';
import type { IAccountStore } from '../../domain/ports/IAccountStore.js';
import type { IBroadcaster } from '../../domain/ports/IBroadcaster.js';

// ─── Length-Prefixed Protocol ────────────────────────────
function createParser(onMessage: (msg: Record<string, unknown>) => void) {
  let buffer = Buffer.alloc(0);
  return function (chunk: Buffer) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const msgLen = buffer.readUInt32BE(0);
      if (msgLen <= 0 || msgLen > 65536) {
        const braceIdx = buffer.indexOf('{', 1);
        if (braceIdx > 0) buffer = buffer.subarray(braceIdx);
        else buffer = Buffer.alloc(0);
        continue;
      }
      if (buffer.length < 4 + msgLen) break;
      const msgBuf = buffer.subarray(4, 4 + msgLen);
      buffer = buffer.subarray(4 + msgLen);
      try {
        const json = JSON.parse(msgBuf.toString('utf8'));
        onMessage(json);
      } catch {
        console.warn('[TCP] JSON parse error');
      }
    }
  };
}

function sendMessage(socket: net.Socket, obj: unknown): boolean {
  try {
    if (socket.destroyed) return false;
    const json = JSON.stringify(obj);
    const body = Buffer.from(json, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    socket.write(Buffer.concat([header, body]));
    return true;
  } catch {
    return false;
  }
}

// ─── TCP Adapter ─────────────────────────────────────────
export class TcpAdapter implements SignalSender {
  private server: net.Server;

  constructor(
    private authenticateEA: AuthenticateEA,
    private processHeartbeat: ProcessHeartbeat,
    private processSignal: ProcessSignal,
    private getDashboard: GetDashboardData,
    private accounts: IAccountStore,
    private broadcaster: IBroadcaster,
  ) {
    this.server = net.createServer((socket: net.Socket) => this.handleConnection(socket));
  }

  listen(port: number): void {
    this.server.listen(port, '0.0.0.0', () => {
      console.log(`  ║  TCP Port  : ${port} (Master/Slave EA)`);
    });
  }

  close(): void {
    this.server.close();
  }

  // ─── SignalSender interface ────────────────────────────
  sendToSlave(_slaveId: string, socketHandle: unknown, message: unknown): void {
    const socket = socketHandle as net.Socket;
    if (socket && !socket.destroyed) {
      sendMessage(socket, message);
    }
  }

  queueForHttpSlave(slaveId: string, message: unknown): void {
    const slave = this.accounts.getSlave(slaveId);
    if (slave && slave.transport === 'http') {
      slave.pendingSignals.push(message);
      if (slave.pendingSignals.length > 100) slave.pendingSignals.shift();
    }
  }

  // ─── Connection Handler ────────────────────────────────
  private handleConnection(socket: net.Socket): void {
    const addr = `${socket.remoteAddress}:${socket.remotePort}`;
    let clientRole: string | null = null;
    let clientId: string | null = null;
    let authenticated = false;

    console.log(`[TCP] New connection from ${addr}`);

    socket.on('data', createParser((msg) => {
      // ─── AUTH ───
      if (msg.action === 'auth') {
        const result = this.authenticateEA.execute({
          id: msg.id as string,
          role: msg.role as 'master' | 'slave',
          token: msg.token as string,
          transport: 'tcp',
          socketHandle: socket,
        });

        if (!result.ok) {
          sendMessage(socket, { action: 'auth_fail', reason: result.error });
          socket.destroy();
          return;
        }

        clientRole = msg.role as string;
        clientId = msg.id as string;
        authenticated = true;

        // Update socket handle on existing account
        const master = this.accounts.getMaster(clientId);
        if (master) master.socketHandle = socket;
        const slave = this.accounts.getSlave(clientId);
        if (slave) slave.socketHandle = socket;

        sendMessage(socket, { action: 'auth_ok', id: clientId, role: clientRole });
        this.broadcaster.broadcast('status', this.getDashboard.getStatus());
        return;
      }

      if (!authenticated) {
        sendMessage(socket, { action: 'error', reason: 'Not authenticated' });
        return;
      }

      // ─── SUBSCRIBE ───
      if (msg.action === 'subscribe' && clientRole === 'slave' && clientId) {
        const slave = this.accounts.getSlave(clientId);
        if (slave) {
          slave.subscribedTo = msg.masterID as string;
          this.broadcaster.broadcast('status', this.getDashboard.getStatus());
        }
        return;
      }

      // ─── HEARTBEAT ───
      if (msg.action === 'heartbeat' && clientId && clientRole) {
        this.processHeartbeat.execute(clientId, clientRole, {
          balance: msg.balance as number,
          equity: msg.equity as number,
          marginLevel: msg.marginLevel as number,
          marginUsed: msg.marginUsed as number,
          freeMargin: msg.freeMargin as number,
          floatingPnL: msg.floatingPnL as number,
          positions: msg.positions as number,
          positionDetails: msg.positionDetails as any[],
          cumulativeDW: msg.cumulativeDW as number,
        });
        sendMessage(socket, { action: 'heartbeat', ts: Date.now() });
        return;
      }

      // ─── SIGNAL ───
      if (msg.action === 'signal' && clientRole === 'master') {
        const masterID = (msg.mid || clientId) as string;
        console.log(`[TCP] Signal from Master "${masterID}": ${msg.type || 'unknown'} ${msg.sym || ''}`);
        const { routed } = this.processSignal.execute(masterID, msg as any);
        console.log(`[TCP] Signal routed to ${routed} slave(s)`);
        return;
      }
    }));

    socket.on('close', () => {
      console.log(`[TCP] Disconnected: ${clientRole || '?'} "${clientId || '?'}" from ${addr}`);
      if (clientId) {
        if (clientRole === 'master') this.accounts.deleteMaster(clientId);
        if (clientRole === 'slave') this.accounts.deleteSlave(clientId);
        this.accounts.addConnectionEvent({
          time: Date.now(), event: 'disconnect', role: clientRole || '', id: clientId,
        });
        this.broadcaster.broadcast('connection', { event: 'disconnect', role: clientRole, id: clientId });
        this.broadcaster.broadcast('status', this.getDashboard.getStatus());
      }
    });

    socket.on('error', (err: Error) => {
      console.error(`[TCP] Error from ${addr}: ${err.message}`);
    });
  }
}
