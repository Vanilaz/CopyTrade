/**
 * ═══════════════════════════════════════════════════════
 *  Domain Service: EquityTracker
 *  Throttled equity history snapshots for chart display
 * ═══════════════════════════════════════════════════════
 */

import type { EquitySnapshot } from '../entities/Performance.js';
import type { IAccountStore } from '../ports/IAccountStore.js';

const SNAPSHOT_INTERVAL = 30000;   // 30 seconds
const MAX_HISTORY = 2880;          // ~24 hours at 30s intervals

export class EquityTracker {
  private history = new Map<string, EquitySnapshot[]>();
  private lastSnapshot = new Map<string, number>();

  snapshot(accountId: string, equity: number, balance: number): void {
    const now = Date.now();
    const lastTs = this.lastSnapshot.get(accountId) || 0;
    if (now - lastTs < SNAPSHOT_INTERVAL) return;

    if (!this.history.has(accountId)) this.history.set(accountId, []);
    const hist = this.history.get(accountId)!;
    hist.push({ ts: now, equity: equity || 0, balance: balance || 0 });
    if (hist.length > MAX_HISTORY) hist.shift();
    this.lastSnapshot.set(accountId, now);
  }

  /**
   * Get equity history for connected accounts only
   */
  getHistory(accounts: IAccountStore): Record<string, EquitySnapshot[]> {
    const result: Record<string, EquitySnapshot[]> = {};
    this.history.forEach((hist, id) => {
      if (!accounts.getMaster(id) && !accounts.getSlave(id)) return;
      result[id] = hist;
    });
    return result;
  }
}
