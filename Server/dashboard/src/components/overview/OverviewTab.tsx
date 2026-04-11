import { useState, useEffect } from 'react';
import type { DashboardData, AccountPerformance, SignalEntry } from '../../types/api';
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock,
  Terminal,
  Signal,
  CreditCard,
  Cpu
} from 'lucide-react';

interface OverviewTabProps {
  data: DashboardData | null;
}

function LiveValue({ value, highlight }: { value: string | number, highlight?: 'success' | 'danger' }) {
  const [prevValue, setPrevValue] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value > prevValue) setFlash('up');
    else if (value < prevValue) setFlash('down');
    
    setPrevValue(value);
    const timer = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <span className={`${flash === 'up' ? 'animate-flash-up' : flash === 'down' ? 'animate-flash-down' : ''} transition-colors duration-200`}>
      {value}
    </span>
  );
}

export function OverviewTab({ data }: OverviewTabProps) {
  if (!data) return null;

  const floatingTotal = data.performance.reduce((sum: number, a: AccountPerformance) => sum + (a.floating || 0), 0);
  const totalSignals = data.signals?.length || 0;

  return (
    <div className="flex flex-col gap-8">
      {/* ─── Hero Bento Grid ─── */}
      <div className="bento-grid">
        <StatCard 
          icon={<Users className="text-accent-primary" />} 
          title="Masters Online" 
          value={data.stats.masterCount} 
          subtitle="Broadcasting nodes" 
        />
        <StatCard 
          icon={<UserCheck className="text-accent-secondary" />} 
          title="Slaves Online" 
          value={data.stats.slaveCount} 
          subtitle="Executing nodes" 
        />
        <StatCard 
          icon={floatingTotal >= 0 ? <TrendingUp className="text-accent-success" /> : <TrendingDown className="text-accent-danger" />} 
          title="Total Floating" 
          value={<LiveValue value={`${floatingTotal >= 0 ? '+' : ''}$${floatingTotal.toFixed(2)}`} highlight={floatingTotal < 0 ? 'danger' : 'success'} />} 
          subtitle="Across all accounts" 
          highlight={floatingTotal < 0 ? 'danger' : 'success'}
        />
        <StatCard 
          icon={<Signal className="text-accent-info" />} 
          title="Session Signals" 
          value={<LiveValue value={totalSignals} />} 
          subtitle="Real-time stream" 
        />
        <StatCard 
          icon={<Clock className="text-gray-400" />} 
          title="Core Uptime" 
          value={data.stats.uptime} 
          subtitle={
            <div className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-accent-primary relative">
                <div className="live-pulse-ring text-accent-primary" />
              </div>
              LIVE ENGINE ACTIVE
            </div>
          } 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Master Terminals */}
        <div className="premium-panel flex flex-col h-[400px]">
          <div className="premium-panel-header">
            <h3 className="premium-title"><Terminal size={14} className="text-accent-warning" /> Master Terminals</h3>
            <span className="status-pill status-pill-online">{data.performance.filter((a: AccountPerformance) => a.role === 'master').length} Active</span>
          </div>
          <div className="premium-body flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {data.performance.filter((a: AccountPerformance) => a.role === 'master').map((acct: AccountPerformance) => (
              <AccountItem key={acct.accountId} acct={acct} />
            ))}
          </div>
        </div>

        {/* Slave Terminals */}
        <div className="premium-panel flex flex-col h-[400px]">
          <div className="premium-panel-header">
            <h3 className="premium-title"><Cpu size={14} className="text-accent-info" /> Slave Terminals</h3>
            <span className="status-pill status-pill-online">{data.performance.filter((a: AccountPerformance) => a.role === 'slave').length} Active</span>
          </div>
          <div className="premium-body flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {data.performance.filter((a: AccountPerformance) => a.role === 'slave').length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
                <CreditCard size={48} />
                <span className="text-xs font-black uppercase tracking-widest">No slaves identified</span>
              </div>
            ) : (
              data.performance.filter((a: AccountPerformance) => a.role === 'slave').map((acct: AccountPerformance) => (
                <AccountItem key={acct.accountId} acct={acct} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Real-time Logs */}
      <div className="premium-panel">
        <div className="premium-panel-header">
          <h3 className="premium-title"><Activity size={14} className="text-accent-secondary" /> Neural Execution Logs</h3>
        </div>
        <div className="bg-black/40 p-6 min-h-[140px] font-mono text-[11px] leading-relaxed">
          {data.signals && data.signals.length > 0 ? (
            [...data.signals].reverse().slice(0, 5).map((sig: SignalEntry, i: number) => (
              <div key={i} className="flex items-center gap-4 mb-2 animate-in">
                <span className="text-gray-600">[{new Date(sig.time).toLocaleTimeString()}]</span>
                <span className="text-accent-primary font-bold">{sig.masterID}</span>
                <span className="px-2 py-0.5 bg-white/5 rounded text-white">{sig.type}</span>
                <span className="text-gray-400 font-bold">{sig.symbol} @ {sig.fillPrice || 'Pending'}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-3 text-gray-600 italic">
              <div className="size-2 rounded-full bg-accent-primary animate-pulse" />
              Listening for market telemetry...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, subtitle, highlight }: any) {
  return (
    <div className="premium-panel p-6 flex flex-col gap-4 hover:border-white/20 transition-all group">
      <div className="flex items-center justify-between">
        <div className="size-10 bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none bg-white/[0.02] px-2 py-1 rounded">Metrics</div>
      </div>
      <div>
        <div className={`text-2xl font-mono font-black tracking-tight mb-1 ${highlight === 'danger' ? 'text-accent-danger' : highlight === 'success' ? 'text-accent-success' : 'text-white'}`}>
          {value}
        </div>
        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{title}</div>
      </div>
      <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest border-t border-white/5 pt-3">{subtitle}</div>
    </div>
  );
}

function AccountItem({ acct }: { acct: any }) {
  const isMaster = acct.role === 'master';
  return (
    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-4">
        <div className={`size-8 rounded-lg flex items-center justify-center font-black text-[10px] ${isMaster ? 'bg-accent-warning/20 text-accent-warning' : 'bg-accent-info/20 text-accent-info'}`}>
          {isMaster ? 'M' : 'S'}
        </div>
        <div>
          <div className="font-mono font-bold text-white text-sm leading-none mb-1">{acct.accountId}</div>
          <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{acct.role.toUpperCase()} // ACTIVE TERMINAL</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono font-bold text-white text-xs leading-none mb-1">${acct.equity?.toLocaleString()}</div>
        <div className={`text-[10px] font-bold uppercase tracking-widest ${acct.floating >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
          {acct.floating >= 0 ? '+' : ''}${acct.floating?.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
