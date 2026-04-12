/**
 * ═══════════════════════════════════════════════════════
 *  Domain Entity: Performance
 *  Per-account performance tracking — period P&L, drawdown, win rate
 * ═══════════════════════════════════════════════════════
 */

export interface AccountPerformance {
  accountId: string;
  role: string;

  // Period snapshots
  dayStartBalance: number;
  dayStartNetBalance: number;
  dayStartKey: string;
  weekStartBalance: number;
  weekStartNetBalance: number;
  weekStartKey: string;
  monthStartBalance: number;
  monthStartNetBalance: number;
  monthStartKey: string;

  // Current metrics
  currentBalance: number;
  currentEquity: number;
  floatingPnL: number;
  marginLevel: number;
  positions: number;

  // Peak tracking
  peakEquity: number;
  maxDrawdown: number;
  maxDrawdownPct: number;

  // Trade counters
  totalTrades: number;
  winTrades: number;
  lossTrades: number;

  // Net balance (excluding deposits/withdrawals)
  lastNetBalance?: number;
  lastCumDW?: number;

  // Timestamps
  firstSeen: number;
  lastUpdate: number;
}

export interface PerformanceSummary {
  accountId: string;
  role: string;
  balance: number;
  equity: number;
  todayPnL: number;
  weekPnL: number;
  monthPnL: number;
  floating: number;
  totalTrades: number;
  winTrades: number;
  lossTrades: number;
  winRate: string;
  maxDrawdown: number;
  maxDrawdownPct: string;
  currentDD: string;
  positions: number;
  marginLevel: number;
  lastUpdate: number;
  subscribedTo?: string;
}

export interface EquitySnapshot {
  ts: number;
  equity: number;
  balance: number;
}

/**
 * Create a fresh AccountPerformance object
 */
export function createPerformance(accountId: string, role: string): AccountPerformance {
  return {
    accountId,
    role,
    dayStartBalance: 0, dayStartNetBalance: 0, dayStartKey: '',
    weekStartBalance: 0, weekStartNetBalance: 0, weekStartKey: '',
    monthStartBalance: 0, monthStartNetBalance: 0, monthStartKey: '',
    currentBalance: 0, currentEquity: 0, floatingPnL: 0,
    marginLevel: 0, positions: 0,
    peakEquity: 0, maxDrawdown: 0, maxDrawdownPct: 0,
    totalTrades: 0, winTrades: 0, lossTrades: 0,
    firstSeen: Date.now(), lastUpdate: Date.now(),
  };
}

/**
 * Compute PerformanceSummary from raw AccountPerformance
 */
export function toPerformanceSummary(perf: AccountPerformance, subscribedTo?: string): PerformanceSummary {
  const netBal = perf.lastNetBalance ?? perf.currentBalance;
  const dayStartNet = perf.dayStartNetBalance ?? perf.dayStartBalance;
  const weekStartNet = perf.weekStartNetBalance ?? perf.weekStartBalance;
  const monthStartNet = perf.monthStartNetBalance ?? perf.monthStartBalance;

  const todayPnL = perf.dayStartBalance > 0 ? (netBal - dayStartNet) + perf.floatingPnL : perf.floatingPnL;
  const weekPnL = perf.weekStartBalance > 0 ? (netBal - weekStartNet) + perf.floatingPnL : perf.floatingPnL;
  const monthPnL = perf.monthStartBalance > 0 ? (netBal - monthStartNet) + perf.floatingPnL : perf.floatingPnL;
  const winRate = perf.totalTrades > 0 ? ((perf.winTrades / perf.totalTrades) * 100).toFixed(1) : '—';
  const currentDD = perf.peakEquity > 0 ? ((perf.peakEquity - perf.currentEquity) / perf.peakEquity * 100) : 0;

  return {
    accountId: perf.accountId, role: perf.role,
    balance: perf.currentBalance, equity: perf.currentEquity,
    todayPnL, weekPnL, monthPnL, floating: perf.floatingPnL,
    totalTrades: perf.totalTrades, winTrades: perf.winTrades, lossTrades: perf.lossTrades,
    winRate, maxDrawdown: perf.maxDrawdown, maxDrawdownPct: perf.maxDrawdownPct.toFixed(2),
    currentDD: currentDD.toFixed(2), positions: perf.positions,
    marginLevel: perf.marginLevel, lastUpdate: perf.lastUpdate,
    subscribedTo,
  };
}
