import { CheckCircle2, AlertCircle, Radio, Activity } from 'lucide-react';
import type { AccountPerformance } from '../../types/api';

interface SyncMonitorProps {
  slaves: AccountPerformance[];
}

export function SyncMonitor({ slaves }: SyncMonitorProps) {
  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
        {slaves.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
            <Radio size={48} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Listening for slave nodes...</span>
          </div>
        ) : (
          slaves.map((slave) => (
            <div key={slave.accountId} className="p-4 bg-white/[0.03] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="size-8 bg-accent-info/20 rounded-lg flex items-center justify-center text-accent-info">
                    <Radio size={16} className="group-hover:animate-pulse" />
                  </div>
                  <div>
                    <div className="font-mono font-bold text-white text-sm tracking-tight">{slave.accountId}</div>
                    <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Slave Instance // 0ms Lag</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 bg-accent-success/10 rounded text-[9px] font-black text-accent-success border border-accent-success/20">
                  <CheckCircle2 size={10} />
                  SYNCED
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                  <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1 leading-none">Equity Relay</div>
                  <div className="font-mono font-bold text-white text-xs">${slave.equity?.toLocaleString()}</div>
                </div>
                <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                  <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1 leading-none">Net Exposure</div>
                  <div className={`font-mono font-bold text-xs ${slave.floating >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                    {slave.floating >= 0 ? '+' : ''}${slave.floating?.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-accent-success shadow-[0_0_8px_var(--color-accent-success)]" />
                  <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Neural Link Verified</span>
                </div>
                <Activity size={12} className="text-white/20" />
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 bg-accent-primary/5 border border-accent-primary/20 rounded-xl">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle size={16} className="text-accent-primary" />
          <span className="text-[10px] font-black text-accent-primary uppercase tracking-widest">Institutional Audit</span>
        </div>
        <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-widest opacity-80">
          Global sync auditor is actively monitoring {slaves.length} execution gateways. Last full sync verify: 1s ago.
        </p>
      </div>
    </div>
  );
}
