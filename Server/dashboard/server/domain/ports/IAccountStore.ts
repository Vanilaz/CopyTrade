/**
 * ═══════════════════════════════════════════════════════
 *  Port: IAccountStore
 *  Interface for managing connected master/slave accounts
 * ═══════════════════════════════════════════════════════
 */

import type { MasterAccount, SlaveAccount, ConnectionEvent } from '../entities/Account.js';

export interface IAccountStore {
  // ─── Master operations ───
  getMaster(id: string): MasterAccount | undefined;
  setMaster(id: string, account: MasterAccount): void;
  deleteMaster(id: string): void;
  allMasters(): Map<string, MasterAccount>;

  // ─── Slave operations ───
  getSlave(id: string): SlaveAccount | undefined;
  setSlave(id: string, account: SlaveAccount): void;
  deleteSlave(id: string): void;
  allSlaves(): Map<string, SlaveAccount>;

  // ─── Connection log ───
  addConnectionEvent(event: ConnectionEvent): void;
  getConnectionLog(): ConnectionEvent[];

  // ─── Counts ───
  masterCount(): number;
  slaveCount(): number;
}
