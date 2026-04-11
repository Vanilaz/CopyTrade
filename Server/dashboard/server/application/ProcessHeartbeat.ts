/**
 * ═══════════════════════════════════════════════════════
 *  Use Case: ProcessHeartbeat
 *  Update account info, performance, equity snapshot
 * ═══════════════════════════════════════════════════════
 */

import type { HeartbeatData } from '../domain/entities/Account.js';
import { applyHeartbeat } from '../domain/entities/Account.js';
import type { IAccountStore } from '../domain/ports/IAccountStore.js';
import type { IBroadcaster } from '../domain/ports/IBroadcaster.js';
import type { PerformanceTracker } from '../domain/services/PerformanceTracker.js';
import type { EquityTracker } from '../domain/services/EquityTracker.js';

export class ProcessHeartbeat {
  private updateTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private accounts: IAccountStore,
    private perfTracker: PerformanceTracker,
    private equityTracker: EquityTracker,
    private broadcaster: IBroadcaster,
    private getStatusFn: () => unknown,
  ) {}

  execute(id: string, role: string, data: HeartbeatData & { cumulativeDW?: number }): void {
    // 1. Find or auto-register account
    let account = this.accounts.getMaster(id) || this.accounts.getSlave(id);
    if (!account) return;

    // 2. Apply heartbeat data to account entity
    applyHeartbeat(account, data);

    // 3. Update performance metrics
    this.perfTracker.update(id, role, data);

    // 4. Snapshot equity for chart
    this.equityTracker.snapshot(id, data.equity || 0, data.balance || 0);

    // 5. Schedule throttled dashboard broadcast
    this.scheduleBroadcast();
  }

  private scheduleBroadcast(): void {
    if (this.updateTimer) return;
    this.updateTimer = setTimeout(() => {
      this.updateTimer = null;
      this.broadcaster.broadcast('status', this.getStatusFn());
      this.broadcaster.broadcast('performance', this.perfTracker.getSummaries(this.accounts));
    }, 1000);
  }
}
