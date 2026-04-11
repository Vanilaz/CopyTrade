// ═══ API Response Types ═══

export interface MasterInfo {
  addr?: string;
  balance?: number;
  equity?: number;
  marginLevel?: number;
  marginUsed?: number;
  freeMargin?: number;
  floatingPnL?: number;
  positions?: number;
  positionDetails?: PositionDetail[];
}

export interface PositionDetail {
  symbol: string;
  type: string;
  lots: number;
  openPrice: number;
  pnl: number;
  swap?: number;
  ticket?: number;
}

export interface MasterAccount {
  id: string;
  transport: string;
  connected: boolean;
  lastHeartbeat: number;
  info: MasterInfo;
}

export interface SlaveAccount {
  id: string;
  subscribedTo: string;
  transport: string;
  connected: boolean;
  lastHeartbeat: number;
  info: MasterInfo;
}

export interface StatusData {
  masters: MasterAccount[];
  slaves: SlaveAccount[];
  signalCount: number;
}

export interface SignalEntry {
  time: number;
  masterID: string;
  type: string;
  symbol: string;
  lots: number;
  price: number;
  fillPrice: number;
  ticket: number;
  fillTimeMs: number;
  seq?: number;
}

export interface AccountPerformance {
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
}

// ═══ Sync Monitor ═══

export interface MasterPositionInfo {
  accountId: string;
  count: number;
  symbols: string[];
  details: PositionDetail[];
}

export interface SlaveSyncInfo {
  accountId: string;
  subscribedTo: string;
  masterPositions: number;
  slavePositions: number;
  synced: boolean;
  missing: number;
  missingSymbols: string[];
  slaveDetails: PositionDetail[];
}

export interface SyncStatus {
  masters: Record<string, MasterPositionInfo>;
  slaves: SlaveSyncInfo[];
}

// ═══ Risk Metrics ═══

export interface SymbolExposure {
  lots: number;
  pnl: number;
  count: number;
}

export interface RiskMetric {
  accountId: string;
  role: string;
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  marginLevel: number;
  marginUsagePct: string;
  positions: number;
  exposure: Record<string, SymbolExposure>;
  floatingPnL: number;
}

// ═══ Equity History ═══

export interface EquitySnapshot {
  ts: number;
  equity: number;
  balance: number;
}

export type EquityHistoryData = Record<string, EquitySnapshot[]>;

// ═══ Positions ═══

export interface AccountPositions {
  role: string;
  details: PositionDetail[];
}

export type PositionsData = Record<string, AccountPositions>;

// ═══ WebSocket Messages ═══

export interface WSMessage {
  type: string;
  data: unknown;
  timestamp: number;
}

// ═══ App State ═══

export type TabId = 'overview' | 'performance' | 'monitor' | 'history';
