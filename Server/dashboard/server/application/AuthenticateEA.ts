/**
 * ═══════════════════════════════════════════════════════
 *  Use Case: AuthenticateEA
 *  Validate EA token, register master/slave account
 * ═══════════════════════════════════════════════════════
 */

import type { TransportType } from '../domain/entities/Account.js';
import { createMasterAccount, createSlaveAccount } from '../domain/entities/Account.js';
import type { IAccountStore } from '../domain/ports/IAccountStore.js';
import type { IBroadcaster } from '../domain/ports/IBroadcaster.js';
import type { PerformanceTracker } from '../domain/services/PerformanceTracker.js';

export interface AuthRequest {
  id: string;
  role: 'master' | 'slave';
  token?: string;
  transport: TransportType;
  socketHandle?: unknown;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export class AuthenticateEA {
  constructor(
    private authToken: string,
    private accounts: IAccountStore,
    private perfTracker: PerformanceTracker,
    private broadcaster: IBroadcaster,
  ) {}

  execute(request: AuthRequest): AuthResult {
    // ─── Token validation ───
    if (this.authToken && request.token !== this.authToken) {
      return { ok: false, error: 'Invalid auth token' };
    }
    if (!request.role || !request.id) {
      return { ok: false, error: 'Missing role or id' };
    }

    // ─── Register account ───
    if (request.role === 'master') {
      const account = createMasterAccount(request.id, request.transport, request.socketHandle);
      this.accounts.setMaster(request.id, account);
    } else {
      const account = createSlaveAccount(request.id, request.transport, request.socketHandle);
      this.accounts.setSlave(request.id, account);
    }

    // ─── Initialize performance tracking ───
    this.perfTracker.getOrCreate(request.id, request.role);

    // ─── Log + broadcast ───
    this.accounts.addConnectionEvent({
      time: Date.now(),
      event: 'connect',
      role: request.role,
      id: request.id,
      transport: request.transport,
    });

    this.broadcaster.broadcast('connection', { event: 'connect', role: request.role, id: request.id });

    return { ok: true };
  }
}
