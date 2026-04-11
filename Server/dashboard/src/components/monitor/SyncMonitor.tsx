import { CheckCircle2, AlertCircle, Radio, Activity } from 'lucide-react';
import type { AccountPerformance, SyncStatus } from '../../types/api';

interface SyncMonitorProps {
  slaves: AccountPerformance[];
  syncData?: SyncStatus;
}

export function SyncMonitor({ slaves, syncData }: SyncMonitorProps) {
  const isHealthy = syncData ? syncData.slaves.every(s => s.synced) : false;

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
        {slaves.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4">
            <Radio size={48} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Listening for slave nodes...</span>
          </div>
        ) : (
          slaves.map((slave) => {
            const syncInfo = syncData?.slaves.find(s => s.accountId === slave.accountId);
            const isSynced = syncInfo?.synced ?? true;
            const missing = syncInfo?.missing ?? 0;

            return (
              <div key={slave.accountId} className={`p-4 bg-white/[0.03] border ${isSynced ? 'border-white/5 hover:bg-white/[0.05]' : 'border-accent-danger/30 hover:bg-accent-danger/5'} rounded-xl transition-all group`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`size-8 rounded-lg flex items-center justify-center ${isSynced ? 'bg-accent-info/20 text-accent-info' : 'bg-accent-danger/20 text-accent-danger'}`}>
                      {isSynced ? <Radio size={16} className="group-hover:animate-pulse" /> : <AlertCircle size={16} className="animate-pulse" />}
                    </div>
                    <div>
                      <div className="font-mono font-bold text-white text-sm tracking-tight">{slave.accountId}</div>
                      <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mt-0.5">
                        {syncInfo?.subscribedTo ? `Following: ${syncInfo.subscribedTo}` : 'Awaiting Master'}
                      </div>
                    </div>
                  </div>
                  {isSynced ? (
                    <div className="flex items-center gap-2 px-2 py-1 bg-accent-success/10 rounded text-[9px] font-black text-accent-success border border-accent-success/20">
                      <CheckCircle2 size={10} />
                      SYNCED
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-2 py-1 bg-accent-danger/10 rounded text-[9px] font-black text-accent-danger border border-accent-danger/20">
                      <AlertCircle size={10} />
                      MISSING ({missing})
                    </div>
                  )}
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
                    <div className={`size-1.5 rounded-full shadow-[0_0_8px_currentColor] ${isSynced ? 'bg-accent-success text-accent-success' : 'bg-accent-danger text-accent-danger'}`} />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      {isSynced 
                        ? 'Neural Link Verified' 
                        : (syncInfo?.missingSymbols.length 
                            ? `Missing: ${syncInfo.missingSymbols.join(', ')}` 
                            : `${missing} Execution(s) Missing`)}
                    </span>
                  </div>
                  <Activity size={12} className={isSynced ? "text-white/20" : "text-accent-danger/50"} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={`p-4 rounded-xl border ${isHealthy ? 'bg-accent-primary/5 border-accent-primary/20' : 'bg-accent-danger/5 border-accent-danger/20'}`}>
        <div className="flex items-center gap-3 mb-2">
          {isHealthy ? <Activity size={16} className="text-accent-primary" /> : <AlertCircle size={16} className="text-accent-danger" />}
          <span className={`text-[10px] font-black uppercase tracking-widest ${isHealthy ? 'text-accent-primary' : 'text-accent-danger'}`}>
            {isHealthy ? 'Institutional Audit' : 'Sync Discrepancy Detected'}
          </span>
        </div>
        <p className="text-[10px] font-bold text-gray-400 leading-relaxed uppercase tracking-widest opacity-80">
          Global sync auditor is monitoring {slaves.length} execution gateways. Realtime sync state verified.
        </p>
      </div>
    </div>
  );
}
