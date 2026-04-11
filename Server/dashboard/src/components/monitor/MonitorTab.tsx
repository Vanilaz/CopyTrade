import type { SyncStatus, RiskMetric, EquityHistoryData, PositionsData } from '../../types/api';
import { SyncMonitor } from './SyncMonitor';
import { RiskDashboard } from './RiskDashboard';
import { EquityChart } from './EquityChart';
import { PositionGrid } from './PositionGrid';

interface MonitorTabProps {
  sync: SyncStatus | null;
  risk: RiskMetric[];
  equityHistory: EquityHistoryData | null;
  positions: PositionsData | null;
}

export function MonitorTab({ sync, risk, equityHistory, positions }: MonitorTabProps) {
  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Equity Chart — Full width */}
      <EquityChart data={equityHistory} />

      {/* Sync + Risk — Side by side */}
      <div className="monitor-grid">
        <SyncMonitor data={sync} />
        <RiskDashboard data={risk} />
      </div>

      {/* Position Grid — Full width */}
      <PositionGrid data={positions} />
    </div>
  );
}
