/**
 * ═══════════════════════════════════════════════════════
 *  Domain Service: PerformanceTracker
 *  P&L, drawdown, win rate — pure business logic
 *  Depends only on ports (IAccountStore, IPersistence)
 * ═══════════════════════════════════════════════════════
 */

import type { AccountPerformance } from '../entities/Performance.js';
import { createPerformance, toPerformanceSummary } from '../entities/Performance.js';
import type { HeartbeatData } from '../entities/Account.js';
import type { IAccountStore } from '../ports/IAccountStore.js';

// ─── Date helpers (pure — no external deps) ──────────────
function getBrokerDate(timezone: string, d = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const p: Record<string, string> = {};
  for (const x of parts) p[x.type] = x.value;
  const h = p.hour === '24' ? '00' : p.hour;
  return new Date(`${p.year}-${p.month}-${p.day}T${h}:${p.minute}:${p.second}`);
}

function getDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getWeekKey(d: Date): string {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export { getBrokerDate, getDateKey, getWeekKey, getMonthKey };

// ─── Performance Tracker Service ─────────────────────────
export class PerformanceTracker {
  private perfMap = new Map<string, AccountPerformance>();
  private timezone: string;

  constructor(timezone: string) {
    this.timezone = timezone;
  }

  getOrCreate(accountId: string, role: string): AccountPerformance {
    if (!this.perfMap.has(accountId)) {
      this.perfMap.set(accountId, createPerformance(accountId, role));
    }
    return this.perfMap.get(accountId)!;
  }

  update(accountId: string, role: string, data: HeartbeatData & { cumulativeDW?: number }): AccountPerformance {
    const perf = this.getOrCreate(accountId, role);
    const now = getBrokerDate(this.timezone);
    const todayKey = getDateKey(now);
    const weekKey = getWeekKey(now);
    const monthKey = getMonthKey(now);

    const newBalance = data.balance || 0;
    const newEquity = data.equity || 0;
    const newCumDW = data.cumulativeDW || 0;
    const currentNetBalance = newBalance - newCumDW;

    if (perf.lastNetBalance === undefined) {
      perf.lastNetBalance = currentNetBalance;
    }

    // ─── Detect closed trade from net balance change ───
    if (perf.currentBalance > 0 && currentNetBalance !== perf.lastNetBalance) {
      const diff = currentNetBalance - perf.lastNetBalance;
      if (Math.abs(diff) > 0.01) {
        perf.totalTrades++;
        if (diff > 0) perf.winTrades++;
        else perf.lossTrades++;
      }
    }

    // ─── Update current metrics ───
    perf.lastNetBalance = currentNetBalance;
    perf.currentBalance = newBalance;
    perf.currentEquity = newEquity;
    perf.floatingPnL = data.floatingPnL || 0;
    perf.marginLevel = data.marginLevel || 0;
    perf.positions = data.positions || 0;
    perf.lastUpdate = Date.now();

    // ─── Period start balance snapshots ───
    if (perf.dayStartKey !== todayKey) {
      perf.dayStartBalance = newBalance;
      perf.dayStartNetBalance = currentNetBalance;
      perf.dayStartKey = todayKey;
    }
    if (perf.weekStartKey !== weekKey) {
      perf.weekStartBalance = newBalance;
      perf.weekStartNetBalance = currentNetBalance;
      perf.weekStartKey = weekKey;
    }
    if (perf.monthStartKey !== monthKey) {
      perf.monthStartBalance = newBalance;
      perf.monthStartNetBalance = currentNetBalance;
      perf.monthStartKey = monthKey;
    }

    // ─── Adjust Peak Equity for Deposits/Withdrawals ───
    if (perf.lastCumDW === undefined) {
      perf.lastCumDW = newCumDW;
    }
    if (newCumDW !== perf.lastCumDW) {
      const dwDiff = newCumDW - perf.lastCumDW;
      perf.peakEquity += dwDiff;
      if (perf.peakEquity < 0) perf.peakEquity = newEquity > 0 ? newEquity : 0;
      perf.lastCumDW = newCumDW;
    }

    // ─── Peak equity & Drawdown ───
    if (newEquity > perf.peakEquity) {
      perf.peakEquity = newEquity;
    }
    if (perf.peakEquity > 0) {
      const dd = perf.peakEquity - newEquity;
      const ddPct = (dd / perf.peakEquity) * 100;
      if (dd > 0 && dd > perf.maxDrawdown) perf.maxDrawdown = dd;
      if (ddPct > 0 && ddPct > perf.maxDrawdownPct) perf.maxDrawdownPct = ddPct;
    }

    return perf;
  }

  reset(accountId?: string | null): void {
    const resetOne = (perf: AccountPerformance) => {
      const bal = perf.currentBalance || 0;
      const eq = perf.currentEquity || bal;
      const now = getBrokerDate(this.timezone);
      perf.peakEquity = eq;
      perf.maxDrawdown = 0;
      perf.maxDrawdownPct = 0;
      perf.totalTrades = 0;
      perf.winTrades = 0;
      perf.lossTrades = 0;
      perf.dayStartBalance = bal;
      perf.dayStartNetBalance = perf.lastNetBalance ?? bal;
      perf.dayStartKey = getDateKey(now);
      perf.weekStartBalance = bal;
      perf.weekStartNetBalance = perf.lastNetBalance ?? bal;
      perf.weekStartKey = getWeekKey(now);
      perf.monthStartBalance = bal;
      perf.monthStartNetBalance = perf.lastNetBalance ?? bal;
      perf.monthStartKey = getMonthKey(now);
      perf.lastCumDW = undefined;
    };

    if (accountId) {
      const perf = this.perfMap.get(accountId);
      if (perf) resetOne(perf);
    } else {
      this.perfMap.forEach(resetOne);
    }
  }

  /**
   * Get performance summaries for connected accounts only
   */
  getSummaries(accounts: IAccountStore) {
    const result: ReturnType<typeof toPerformanceSummary>[] = [];
    this.perfMap.forEach((perf, id) => {
      if (!accounts.getMaster(id) && !accounts.getSlave(id)) return;
      result.push(toPerformanceSummary(perf));
    });
    return result;
  }

  /**
   * Generate daily report data
   */
  getDailyReport(accounts?: IAccountStore) {
    let totalPnl = 0, totalAum = 0, totalWins = 0, totalTradesCount = 0;
    const lines: string[] = [];

    this.perfMap.forEach((perf, id) => {
      // Skip if it's not connected and we have the account store
      if (accounts && !accounts.getMaster(id) && !accounts.getSlave(id)) return;

      const pnl = perf.dayStartBalance > 0 && perf.lastNetBalance !== undefined
        ? (perf.lastNetBalance - perf.dayStartNetBalance) + perf.floatingPnL
        : perf.floatingPnL;
      totalPnl += pnl;
      totalAum += perf.currentEquity;
      totalWins += perf.winTrades;
      totalTradesCount += perf.totalTrades;
      const emoji = pnl >= 0 ? '🟢' : '🔴';
      lines.push(`${emoji} ${id} (${perf.role === 'master' ? 'M' : 'S'}): $${pnl.toFixed(2)}`);
    });

    const winRate = totalTradesCount > 0 ? ((totalWins / totalTradesCount) * 100).toFixed(1) : '0.0';
    return { totalPnl, totalAum, totalWins, totalTradesCount, winRate, lines };
  }

  // ─── Serialization ─────────────────────────────────────
  exportAll(): Record<string, AccountPerformance> {
    const result: Record<string, AccountPerformance> = {};
    this.perfMap.forEach((v, k) => { result[k] = v; });
    return result;
  }

  importAll(data: Record<string, AccountPerformance>): void {
    for (const [k, v] of Object.entries(data)) {
      this.perfMap.set(k, v);
    }
  }

  get size(): number { return this.perfMap.size; }
}
