/**
 * ═══════════════════════════════════════════════════════
 *  Use Case: ResetPerformance
 *  Reset performance stats for one or all accounts
 * ═══════════════════════════════════════════════════════
 */

import type { IBroadcaster } from '../domain/ports/IBroadcaster.js';
import type { IAccountStore } from '../domain/ports/IAccountStore.js';
import type { PerformanceTracker } from '../domain/services/PerformanceTracker.js';
import type { IPersistence } from '../domain/ports/IPersistence.js';

export class ResetPerformance {
  constructor(
    private perfTracker: PerformanceTracker,
    private accounts: IAccountStore,
    private broadcaster: IBroadcaster,
    private persistence: IPersistence,
  ) {}

  execute(accountId?: string | null): { ok: boolean; message: string } {
    this.perfTracker.reset(accountId);
    this.persistence.savePerformance(this.perfTracker.exportAll());
    this.broadcaster.broadcast('performance', this.perfTracker.getSummaries(this.accounts));

    const message = accountId
      ? `Reset account ${accountId}`
      : 'Reset ALL accounts';

    return { ok: true, message };
  }
}
