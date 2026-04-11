import { Activity, Shield, Hash, LineChart } from 'lucide-react';
import { PositionGrid } from './PositionGrid';
import { SyncMonitor } from './SyncMonitor';
import { RiskDashboard } from './RiskDashboard';
import { EquityChart } from './EquityChart';
import type { DashboardData, AccountPerformance, SignalEntry } from '../../types/api';

interface MonitorTabProps {
  data: DashboardData | null;
}

export function MonitorTab({ data }: MonitorTabProps) {
  if (!data) return null;

  return (
    <div className="flex flex-col gap-10">
      {/* ─── Top Telemetry: Risk & Sync ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 premium-panel flex flex-col min-h-[440px]">
          <div className="premium-panel-header">
            <h3 className="premium-title"><LineChart size={14} className="text-accent-primary" /> Multi-Node Equity Telemetry</h3>
            <div className="text-[10px] uppercase font-black text-gray-500 tracking-widest bg-white/[0.03] px-2 py-1 rounded">Real-time Stream</div>
          </div>
          <div className="flex-1 p-6">
            <EquityChart history={data.equityHistory || []} />
          </div>
        </div>
        
        <div className="premium-panel flex flex-col">
          <div className="premium-panel-header">
            <h3 className="premium-title"><Shield size={14} className="text-accent-success" /> Sync Status Auditor</h3>
          </div>
          <div className="flex-1 p-6">
            <SyncMonitor slaves={data.performance.filter((a: AccountPerformance) => a.role === 'slave')} />
          </div>
        </div>
      </div>

      {/* ─── Middle Section: Risk Distribution ─── */}
      <div className="premium-panel">
        <div className="premium-panel-header">
          <h3 className="premium-title"><Hash size={14} className="text-accent-secondary" /> Risk Concentration Dashboard</h3>
        </div>
        <div className="p-8">
          <RiskDashboard slaves={data.performance.filter((a: AccountPerformance) => a.role === 'slave')} />
        </div>
      </div>

      {/* ─── Bottom Section: Active Position Matrix ─── */}
      <div className="premium-panel">
        <div className="premium-panel-header">
          <h3 className="premium-title"><Activity size={14} className="text-accent-warning" /> Active Position Matrix</h3>
          <span className="status-pill status-pill-online">{data.signals.filter((s: SignalEntry) => s.type === 'market_buy' || s.type === 'market_sell').length} Tracked</span>
        </div>
        <div className="overflow-x-auto">
          <PositionGrid data={data} />
        </div>
      </div>
    </div>
  );
}
