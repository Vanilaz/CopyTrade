import type { HistoricalTrade } from '../../types/api';
import { 
  Database, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Clock,
  ExternalLink
} from 'lucide-react';

interface HistoryTabProps {
  data: HistoricalTrade[];
}

export function HistoryTab({ data }: HistoryTabProps) {
  return (
    <div className="flex flex-col gap-8 animate-in">
      <div className="premium-panel overflow-hidden">
        <div className="premium-panel-header">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-accent-secondary/20 rounded-lg flex items-center justify-center">
              <Database size={16} className="text-accent-secondary" />
            </div>
            <div>
              <h3 className="premium-title">Institutional Archive</h3>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Historical Execution Stream</p>
            </div>
          </div>
          <div className="status-pill bg-white/[0.03] border-white/5 text-gray-400">
            {data.length} RECORDS
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="data-matrix">
            <thead>
              <tr>
                <th>Execution ID</th>
                <th>Symbol</th>
                <th>Type</th>
                <th>Volume</th>
                <th>Entry Price</th>
                <th>Profit (USD)</th>
                <th>Settlement Time</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center opacity-30 italic">
                    <div className="flex flex-col items-center gap-4">
                      <Clock size={32} />
                      <span className="uppercase tracking-widest font-black">Archive Empty</span>
                    </div>
                  </td>
                </tr>
              ) : (
                [...data].reverse().map((trade) => (
                  <tr key={trade.ticket} className="group">
                    <td>
                      <span className="text-gray-500">#</span>
                      <span className="text-white font-bold">{trade.ticket}</span>
                    </td>
                    <td>
                      <div className="bg-white/5 px-2 py-1 rounded inline-block font-black text-white">
                        {trade.symbol}
                      </div>
                    </td>
                    <td>
                      <SignalBadge type={trade.type} />
                    </td>
                    <td className="text-white font-bold">{trade.volume.toFixed(2)}</td>
                    <td className="text-gray-400">${trade.price?.toLocaleString()}</td>
                    <td>
                      <div className={`flex items-center gap-1.5 font-black ${trade.profit >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                        {trade.profit >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        ${Math.abs(trade.profit).toLocaleString()}
                      </div>
                    </td>
                    <td className="text-gray-500">
                      {new Date(trade.time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="text-right">
                      <button className="p-2 hover:bg-white/10 rounded-lg text-gray-500 hover:text-white transition-all">
                        <ExternalLink size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SignalBadge({ type }: { type: string }) {
  const isBuy = type.toLowerCase().includes('buy');
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-widest inline-flex ${isBuy ? 'text-accent-success bg-accent-success/10 border border-accent-success/20' : 'text-accent-danger bg-accent-danger/10 border border-accent-danger/20'}`}>
      {isBuy ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {type}
    </div>
  );
}
