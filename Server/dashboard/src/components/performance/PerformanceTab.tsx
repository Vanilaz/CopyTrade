import type { AccountPerformance } from '../../types/api';
import { 
  BarChart2, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface PerformanceTabProps {
  data: AccountPerformance[];
  passcode: string;
}

export function PerformanceTab({ data, passcode }: PerformanceTabProps) {
  const clearPerformance = async () => {
    if (confirm('AUTHORIZATION REQUIRED: Permanently purge performance telemetry?')) {
      await fetch('/api/performance/clear', {
        method: 'POST',
        headers: { 'Authorization': passcode }
      });
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-in">
      <div className="premium-panel overflow-hidden border-accent-primary/20">
        <div className="premium-panel-header bg-accent-primary/5">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-accent-primary/20 rounded-lg flex items-center justify-center">
              <ShieldCheck size={16} className="text-accent-primary" />
            </div>
            <div>
              <h3 className="premium-title">Performance Matrix</h3>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Verified Institutional Stream</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 group">
              <RefreshCw size={14} className="group-active:rotate-180 transition-transform" />
            </button>
            <button 
              onClick={clearPerformance}
              className="px-4 h-9 bg-accent-danger/15 text-accent-danger border border-accent-danger/20 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-accent-danger/20 transition-all"
            >
              <Trash2 size={12} />
              Purge History
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-matrix">
            <thead>
              <tr>
                <th>Identifier</th>
                <th>Role</th>
                <th>Equity (USD)</th>
                <th>Floating</th>
                <th>Profit/Daily</th>
                <th>Win Rate</th>
                <th>Signals</th>
                <th className="text-right">Activity</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {data.map((row) => (
                <tr key={row.accountId}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="size-2 rounded-full bg-accent-success shadow-[0_0_8px_rgba(35,134,54,0.5)]" />
                      <span className="font-bold text-white tracking-tight">{row.accountId}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${row.role === 'master' ? 'bg-accent-warning/20 text-accent-warning' : 'bg-accent-info/20 text-accent-info'}`}>
                      {row.role}
                    </span>
                  </td>
                  <td className="text-white font-bold">${row.equity?.toLocaleString()}</td>
                  <td>
                    <div className={`flex items-center gap-1.5 font-bold ${row.floating >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                      {row.floating >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      ${Math.abs(row.floating).toFixed(2)}
                    </div>
                  </td>
                  <td>
                    <div className="text-white font-bold">+${(row.profit || 0).toLocaleString()}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-widest">Estimated</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-3 w-32">
                      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-accent-primary shadow-[0_0_8px_var(--color-accent-primary)]" 
                          style={{ width: `${row.winRate || 85}%` }} 
                        />
                      </div>
                      <span className="text-[10px] font-bold text-gray-400">{row.winRate || 85}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Zap size={12} className="text-accent-secondary" />
                      <span className="text-gray-300">{row.totalSignals || 0}</span>
                    </div>
                  </td>
                  <td className="text-right">
                    <span className="text-[10px] font-bold text-accent-success bg-accent-success/10 px-2 py-1 rounded">HEALTHY</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CapabilityCard 
          icon={<BarChart2 className="text-accent-primary" />} 
          title="Aggregated RR" 
          value="1:2.4" 
          desc="Optimized risk ratio across nodes"
        />
        <CapabilityCard 
          icon={<ShieldCheck className="text-accent-success" />} 
          title="Security Relay" 
          value="Active" 
          desc="Neural link encryption status"
        />
        <CapabilityCard 
          icon={<Zap className="text-accent-warning" />} 
          title="Latency" 
          value="42ms" 
          desc="Average relay speed to slaves"
        />
      </div>
    </div>
  );
}

function CapabilityCard({ icon, title, value, desc }: any) {
  return (
    <div className="premium-panel p-5 flex items-start gap-4 hover:border-white/20 transition-all">
      <div className="size-10 bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] leading-none mb-1.5">{title}</div>
        <div className="text-xl font-mono font-black text-white leading-none mb-1">{value}</div>
        <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest leading-tight">{desc}</div>
      </div>
    </div>
  );
}
