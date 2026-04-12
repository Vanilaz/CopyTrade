/**
 * ═══════════════════════════════════════════════════════
 *  Domain Service: EquityTracker
 *  Throttled equity history snapshots for chart display
 *  ★ v3.0.3: Adaptive downsample — 1s recent, 10s older
 * ═══════════════════════════════════════════════════════
 */

import type { EquitySnapshot } from '../entities/Performance.js';
import type { IAccountStore } from '../ports/IAccountStore.js';

const SNAPSHOT_INTERVAL = 1000;    // 1 second (High fidelity)
const MAX_RAW_HISTORY = 3600;      // 1 hour of 1s snapshots (raw)
const DOWNSAMPLE_INTERVAL = 10000; // Older data: keep 1 point per 10s
const MAX_TOTAL_POINTS = 5000;     // Hard cap (~4h of mixed resolution)

export class EquityTracker {
  private history = new Map<string, EquitySnapshot[]>();
  private lastSnapshot = new Map<string, number>();
  private lastDownsample = new Map<string, number>();
  
  deleteAccount(accountId: string): void {
    this.history.delete(accountId);
    this.lastSnapshot.delete(accountId);
    this.lastDownsample.delete(accountId);
    console.log(`[EquityTracker] Purged chart history for account: ${accountId}`);
  }

  snapshot(accountId: string, equity: number, balance: number): void {
    const now = Date.now();
    const lastTs = this.lastSnapshot.get(accountId) || 0;
    if (now - lastTs < SNAPSHOT_INTERVAL) return;

    if (!this.history.has(accountId)) this.history.set(accountId, []);
    const hist = this.history.get(accountId)!;
    hist.push({ ts: now, equity: equity || 0, balance: balance || 0 });
    this.lastSnapshot.set(accountId, now);

    // Periodic downsample (every 60s)
    const lastDS = this.lastDownsample.get(accountId) || 0;
    if (now - lastDS > 60000) {
      this.downsample(accountId);
      this.lastDownsample.set(accountId, now);
    }
  }

  /**
   * Downsample: keep 1s resolution for recent data, thin older data to 10s
   */
  private downsample(accountId: string): void {
    const hist = this.history.get(accountId);
    if (!hist || hist.length < MAX_RAW_HISTORY) return;

    const now = Date.now();
    const recentCutoff = now - (MAX_RAW_HISTORY * 1000); // 1 hour ago

    const recent: EquitySnapshot[] = [];
    const older: EquitySnapshot[] = [];

    for (const snap of hist) {
      if (snap.ts >= recentCutoff) {
        recent.push(snap);
      } else {
        older.push(snap);
      }
    }

    // Thin older data: keep only 1 per DOWNSAMPLE_INTERVAL
    const thinned: EquitySnapshot[] = [];
    let lastKeptTs = 0;
    for (const snap of older) {
      if (snap.ts - lastKeptTs >= DOWNSAMPLE_INTERVAL) {
        thinned.push(snap);
        lastKeptTs = snap.ts;
      }
    }

    const merged = [...thinned, ...recent];
    // Hard cap
    if (merged.length > MAX_TOTAL_POINTS) {
      merged.splice(0, merged.length - MAX_TOTAL_POINTS);
    }

    this.history.set(accountId, merged);
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
