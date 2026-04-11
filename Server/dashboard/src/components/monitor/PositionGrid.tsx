import type { DashboardData, SignalEntry } from '../../types/api';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  MapPin,
  Tag
} from 'lucide-react';

interface PositionGridProps {
  data: DashboardData;
}

export function PositionGrid({ data }: PositionGridProps) {
  const activeSignals = data.signals.filter((s: SignalEntry) => s.type === 'market_buy' || s.type === 'market_sell');

  if (activeSignals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 opacity-30 gap-6">
        <div className="size-20 bg-white/5 rounded-full flex items-center justify-center">
          <MapPin size={40} className="text-gray-400" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black tracking-widest uppercase text-gray-400">Neutral Exposure</h3>
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">No active positions detected in relay</p>
        </div>
      </div>
    );
  }

  return (
    <table className="data-matrix border-t border-white/5">
      <thead>
        <tr>
          <th>Signal Node</th>
          <th>Asset</th>
          <th>Direction</th>
          <th>Lots</th>
          <th>Entry Price</th>
          <th>Execution Time</th>
          <th className="text-right">Verification</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {activeSignals.map((sig: SignalEntry, i: number) => (
          <tr key={i} className="group">
            <td>
              <div className="flex items-center gap-3">
                <div className="size-2 rounded-full bg-accent-primary animate-pulse shadow-[0_0_8px_var(--color-accent-primary)]" />
                <span className="font-bold text-white">{sig.masterID}</span>
              </div>
            </td>
            <td>
              <div className="flex items-center gap-2">
                <Tag size={12} className="text-accent-secondary" />
                <span className="font-black text-white">{sig.symbol}</span>
              </div>
            </td>
            <td>
              <DirectionBadge type={sig.type} />
            </td>
            <td className="text-white font-bold">{sig.volume || sig.lots}</td>
            <td className="text-gray-300">
              {sig.fillPrice ? `$${sig.fillPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'PENDING'}
            </td>
            <td className="text-gray-500">
              <div className="flex items-center gap-2">
                <Clock size={12} />
                {new Date(sig.time).toLocaleTimeString()}
              </div>
            </td>
            <td className="text-right">
              {sig.fillPrice ? (
                <span className="text-[9px] font-black tracking-widest bg-accent-success/10 text-accent-success px-2 py-1 rounded border border-accent-success/20">
                  EXECUTED {sig.fillTimeMs ? `(${sig.fillTimeMs}ms)` : ''}
                </span>
              ) : (
                <span className="text-[9px] font-black tracking-widest bg-accent-warning/10 text-accent-warning px-2 py-1 rounded border border-accent-warning/20 animate-pulse">
                  ROUTING
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DirectionBadge({ type }: { type: string }) {
  const isBuy = type.includes('buy');
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded font-black text-[10px] uppercase tracking-widest ${isBuy ? 'text-accent-success bg-accent-success/10' : 'text-accent-danger bg-accent-danger/10'}`}>
      {isBuy ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {isBuy ? 'Long' : 'Short'}
    </div>
  );
}
