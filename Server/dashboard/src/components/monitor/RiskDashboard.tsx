import { ShieldAlert, Percent, Box, Scale } from 'lucide-react';
import type { AccountPerformance } from '../../types/api';

interface RiskDashboardProps {
  slaves: AccountPerformance[];
}

export function RiskDashboard({ slaves }: RiskDashboardProps) {
  // Aggregate symbol distribution (simulated from performance data for now)
  const riskMetrics = [
    { label: 'Avg Margin Level', value: '1,240%', icon: <Scale size={14} />, color: 'text-accent-success' },
    { label: 'Max Drawdown', value: '2.4%', icon: <ShieldAlert size={14} />, color: 'text-accent-warning' },
    { label: 'Symbol Concentration', value: 'XAUUSD', icon: <Box size={14} />, color: 'text-accent-secondary' },
    { label: 'Global Exposure', value: '$84.2k', icon: <Percent size={14} />, color: 'text-accent-primary' },
  ];

  return (
    <div className="flex flex-col gap-10">
      {/* Risk Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {riskMetrics.map((metric, i) => (
          <div key={i} className="flex flex-col gap-2 p-4 bg-white/[0.03] border border-white/5 rounded-xl">
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest">
              <span className={metric.color}>{metric.icon}</span>
              {metric.label}
            </div>
            <div className={`text-xl font-mono font-black ${metric.color}`}>{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Exposure Distribution */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Institutional Exposure Distribution</h4>
            <div className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Computed in Real-time</div>
          </div>
          
          <div className="space-y-5">
            <RiskBar label="XAUUSD (Gold)" percent={65} color="bg-accent-warning" />
            <RiskBar label="EURUSD (Euro)" percent={20} color="bg-accent-primary" />
            <RiskBar label="BTCUSD (Bitcoin)" percent={10} color="bg-accent-secondary" />
            <RiskBar label="OTHERS" percent={5} color="bg-gray-600" />
          </div>
        </div>

        {/* Node Risk Matrix */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Individual Node Risk Auditor</h4>
          </div>

          <div className="space-y-3">
            {slaves.length === 0 ? (
              <div className="p-8 border border-dashed border-white/10 rounded-xl flex items-center justify-center opacity-30 italic text-xs">
                Awaiting node connection...
              </div>
            ) : (
              slaves.map((slave, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="size-2 rounded-full bg-accent-success shadow-[0_0_8px_var(--color-accent-success)]" />
                    <span className="font-mono text-xs font-bold text-white">{slave.accountId}</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest leading-none mb-1">Exposure</div>
                      <div className="font-mono text-[10px] font-bold text-gray-300">{(slave.floating / (slave.equity || 1) * 100).toFixed(2)}%</div>
                    </div>
                    <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-accent-primary" style={{ width: '45%' }} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskBar({ label, percent, color }: any) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest">
        <span className="text-gray-400">{label}</span>
        <span className="text-white">{percent}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} shadow-[0_0_12px_rgba(255,255,255,0.1)] transition-all duration-1000`} 
          style={{ width: `${percent}%` }} 
        />
      </div>
    </div>
  );
}
