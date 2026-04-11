/**
 * ═══════════════════════════════════════════════════════
 *  Domain Service: SignalRouter
 *  Routes signals from master → subscribed slaves
 *  Pure logic — doesn't send anything, returns targets
 * ═══════════════════════════════════════════════════════
 */

import type { IAccountStore } from '../ports/IAccountStore.js';
import type { SlaveAccount } from '../entities/Account.js';

export interface RouteTarget {
  slaveId: string;
  slave: SlaveAccount;
}

export class SignalRouter {
  constructor(private accounts: IAccountStore) {}

  /**
   * Find all slaves subscribed to a given master
   * Returns target list — caller is responsible for delivery
   */
  findTargets(masterID: string): RouteTarget[] {
    const targets: RouteTarget[] = [];
    this.accounts.allSlaves().forEach((slave, slaveId) => {
      if (slave.subscribedTo === masterID || slave.subscribedTo === '') {
        targets.push({ slaveId, slave });
      }
    });
    return targets;
  }
}
