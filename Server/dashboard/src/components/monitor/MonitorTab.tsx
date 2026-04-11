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
    <div className="flex flex-col gap-10 animate-in fade-in duration-700">
      {/* ─── Top Telemetry: Risk & Sync ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2 premium-panel flex flex-col min-h-[480px] group relative">
          <div className="hud-bracket hud-bracket-tl" />
          <div className="hud-bracket hud-bracket-tr" />
          <div className="scanning-line opacity-10" />
          
          <div className="premium-panel-header">
            <h3 className="premium-title"><LineChart size={14} className="text-accent-primary animate-pulse" /> Multi-Node Equity Telemetry</h3>
            <div className="flex items-center gap-3">
               <span className="text-[9px] font-black text-accent-primary uppercase tracking-[0.2em] animate-glow">Live_Feed</span>
               <div className="text-[10px] uppercase font-black text-gray-600 tracking-widest bg-white/[0.03] px-3 py-1 rounded-lg border border-white/5">BUFFER_256KB</div>
            </div>
          </div>
          <div className="flex-1 p-8">
            <EquityChart history={data.equityHistory || []} />
          </div>
        </div>
        
        <div className="premium-panel flex flex-col group relative">
          <div className="hud-bracket hud-bracket-tl" />
          <div className="hud-bracket hud-bracket-tr" />
          <div className="scanning-line opacity-10" />
          
          <div className="premium-panel-header">
            <h3 className="premium-title"><Shield size={14} className="text-accent-success" /> Sync Status Auditor</h3>
            <div className="size-1.5 rounded-full bg-accent-success relative">
              <div className="live-pulse-ring text-accent-success" />
            </div>
          </div>
          <div className="flex-1 p-8">
            <SyncMonitor 
              slaves={data.performance.filter((a: AccountPerformance) => a.role === 'slave')} 
              syncData={data.sync}
            />
          </div>
        </div>
      </div>

      {/* ─── Middle Section: Risk Distribution ─── */}
      <div className="premium-panel group relative">
        <div className="hud-bracket hud-bracket-tl" />
        <div className="hud-bracket hud-bracket-tr" />
        <div className="scanning-line opacity-5" />
        
        <div className="premium-panel-header">
          <h3 className="premium-title"><Hash size={14} className="text-accent-secondary" /> Risk Concentration Dashboard</h3>
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Matrix_V2.0</span>
        </div>
        <div className="p-10">
          <RiskDashboard 
            slaves={data.performance.filter((a: AccountPerformance) => a.role === 'slave')} 
            risk={data.risk || []}
          />
        </div>
      </div>

      {/* ─── Bottom Section: Active Position Matrix ─── */}
      <div className="premium-panel group relative overflow-hidden">
        <div className="hud-bracket hud-bracket-tl" />
        <div className="hud-bracket hud-bracket-tr" />
        <div className="scanning-line opacity-10" />
        
        <div className="premium-panel-header">
          <div className="flex items-center gap-4">
            <h3 className="premium-title"><Activity size={14} className="text-accent-warning" /> Active Position Matrix</h3>
            <span className="px-2 py-0.5 bg-accent-warning/10 text-accent-warning text-[9px] font-black rounded border border-accent-warning/20">
              {data.signals.filter((s: SignalEntry) => s.type === 'market_buy' || s.type === 'market_sell').length} ACTIVE_TRACKS
            </span>
          </div>
          <div className="flex items-center gap-4 text-[9px] font-black text-gray-600 uppercase tracking-widest">
            <span>Scan_Mode: Continuous</span>
          </div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <PositionGrid data={data} />
        </div>
      </div>
    </div>
  );
}

