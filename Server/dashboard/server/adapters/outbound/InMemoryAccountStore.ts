/**
 * ═══════════════════════════════════════════════════════
 *  Outbound Adapter: InMemoryAccountStore
 *  Implements IAccountStore using in-memory Maps
 * ═══════════════════════════════════════════════════════
 */

import type { MasterAccount, SlaveAccount, ConnectionEvent } from '../../domain/entities/Account.js';
import type { IAccountStore } from '../../domain/ports/IAccountStore.js';

const MAX_CONNECTION_LOG = 500;

export class InMemoryAccountStore implements IAccountStore {
  private masters = new Map<string, MasterAccount>();
  private slaves = new Map<string, SlaveAccount>();
  private connectionLog: ConnectionEvent[] = [];

  // ─── Master ────────────────────────────────────────────
  getMaster(id: string): MasterAccount | undefined { return this.masters.get(id); }
  setMaster(id: string, account: MasterAccount): void { this.masters.set(id, account); }
  deleteMaster(id: string): void { this.masters.delete(id); }
  allMasters(): Map<string, MasterAccount> { return this.masters; }

  // ─── Slave ─────────────────────────────────────────────
  getSlave(id: string): SlaveAccount | undefined { return this.slaves.get(id); }
  setSlave(id: string, account: SlaveAccount): void { this.slaves.set(id, account); }
  deleteSlave(id: string): void { this.slaves.delete(id); }
  allSlaves(): Map<string, SlaveAccount> { return this.slaves; }

  // ─── Connection log ────────────────────────────────────
  addConnectionEvent(event: ConnectionEvent): void {
    this.connectionLog.push(event);
    if (this.connectionLog.length > MAX_CONNECTION_LOG) this.connectionLog.shift();
  }
  getConnectionLog(): ConnectionEvent[] { return this.connectionLog; }

  // ─── Counts ────────────────────────────────────────────
  masterCount(): number { return this.masters.size; }
  slaveCount(): number { return this.slaves.size; }
}
