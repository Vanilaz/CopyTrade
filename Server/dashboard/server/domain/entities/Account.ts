/**
 * ═══════════════════════════════════════════════════════
 *  Domain Entity: Account
 *  Master/Slave trading accounts — framework-agnostic
 * ═══════════════════════════════════════════════════════
 */

// ─── Position Detail ─────────────────────────────────────
export interface PositionDetail {
  symbol: string;
  direction: 'buy' | 'sell' | string;
  lots: number;
  openPrice: number;
  currentPrice?: number;
  pnl: number;
  swap?: number;
  ticket?: number;
  openTime?: string;
}

// ─── Account Financial Info ──────────────────────────────
export interface AccountInfo {
  balance: number;
  equity: number;
  marginLevel: number;
  marginUsed: number;
  freeMargin: number;
  floatingPnL: number;
  positions: number;
  positionDetails: PositionDetail[];
  addr?: string;
}

// ─── Transport Type ──────────────────────────────────────
export type TransportType = 'tcp' | 'http';

// ─── Base Account ────────────────────────────────────────
export interface BaseAccount {
  id: string;
  transport: TransportType;
  lastHeartbeat: number;
  info: AccountInfo;
  socketHandle?: unknown;  // opaque — domain ไม่รู้จัก socket จริง
}

// ─── Master Account ──────────────────────────────────────
export interface MasterAccount extends BaseAccount {
  role: 'master';
}

// ─── Slave Account ───────────────────────────────────────
export interface SlaveAccount extends BaseAccount {
  role: 'slave';
  subscribedTo: string;        // master ID subscribed to
  pendingSignals: unknown[];   // queued signals for HTTP polling
}

// ─── Heartbeat Data (from EA) ────────────────────────────
export interface HeartbeatData {
  balance?: number;
  equity?: number;
  marginLevel?: number;
  marginUsed?: number;
  freeMargin?: number;
  floatingPnL?: number;
  positions?: number;
  positionDetails?: PositionDetail[];
  cumulativeDW?: number;
}

// ─── Connection Event ────────────────────────────────────
export interface ConnectionEvent {
  time: number;
  event: 'connect' | 'disconnect';
  role: string;
  id: string;
  transport?: TransportType;
}

// ─── Factory Functions ───────────────────────────────────
export function createMasterAccount(id: string, transport: TransportType, socketHandle?: unknown): MasterAccount {
  return {
    id,
    role: 'master',
    transport,
    lastHeartbeat: Date.now(),
    info: { balance: 0, equity: 0, marginLevel: 0, marginUsed: 0, freeMargin: 0, floatingPnL: 0, positions: 0, positionDetails: [] },
    socketHandle,
  };
}

export function createSlaveAccount(id: string, transport: TransportType, socketHandle?: unknown): SlaveAccount {
  return {
    id,
    role: 'slave',
    transport,
    lastHeartbeat: Date.now(),
    subscribedTo: '',
    pendingSignals: [],
    info: { balance: 0, equity: 0, marginLevel: 0, marginUsed: 0, freeMargin: 0, floatingPnL: 0, positions: 0, positionDetails: [] },
    socketHandle,
  };
}

// ─── Update account info from heartbeat ──────────────────
export function applyHeartbeat(account: BaseAccount, data: HeartbeatData): void {
  account.lastHeartbeat = Date.now();
  if (data.balance !== undefined) account.info.balance = data.balance;
  if (data.equity !== undefined) account.info.equity = data.equity;
  if (data.marginLevel !== undefined) account.info.marginLevel = data.marginLevel;
  if (data.marginUsed !== undefined) account.info.marginUsed = data.marginUsed;
  if (data.freeMargin !== undefined) account.info.freeMargin = data.freeMargin;
  if (data.floatingPnL !== undefined) account.info.floatingPnL = data.floatingPnL;
  if (data.positions !== undefined) account.info.positions = data.positions;
  if (data.positionDetails) account.info.positionDetails = data.positionDetails;
}
