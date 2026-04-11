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
      <div className="flex flex-col items-center justify-center p-24 opacity-20 gap-8 group/empty">
        <div className="size-24 bg-white/[0.03] border border-white/5 rounded-full flex items-center justify-center group-hover/empty:scale-110 group-hover/empty:border-accent-primary/20 transition-all duration-700">
          <MapPin size={48} className="text-gray-600 group-hover/empty:text-accent-primary transition-colors" />
        </div>
        <div className="text-center">
          <h3 className="text-xl font-black tracking-[0.4em] uppercase text-gray-500">Neutral Exposure</h3>
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest mt-3">NO_ACTIVE_POSITIONS_IN_RELAY_STREAM</p>
        </div>
      </div>
    );
  }

  return (
    <table className="data-matrix border-t border-white/5">
      <thead>
        <tr className="border-b border-white/5">
          <th>SIGNAL_NODE</th>
          <th>ASSET_INSTRUMENT</th>
          <th>DIR_VECTOR</th>
          <th>TOTAL_LOTS</th>
          <th>ENTRY_PRICE</th>
          <th>EXECUTION_TS</th>
          <th className="text-right">RE_VERIFICATION</th>
        </tr>
      </thead>
      <tbody className="font-mono text-xs">
        {activeSignals.map((sig: SignalEntry, i: number) => (
          <tr key={i} className="group hover:bg-white/[0.03] transition-colors border-b border-white/[0.02]">
            <td className="pl-6">
              <div className="flex items-center gap-4">
                <div className="size-2 rounded-full bg-accent-primary shadow-[0_0_10px_var(--color-accent-primary)] animate-pulse" />
                <span className="font-black text-white tracking-tighter uppercase">{sig.masterID}</span>
              </div>
            </td>
            <td>
              <div className="flex items-center gap-3">
                <Tag size={12} className="text-accent-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                <span className="font-black text-text-main group-hover:text-accent-primary transition-colors">{sig.symbol}</span>
              </div>
            </td>
            <td>
              <DirectionBadge type={sig.type} />
            </td>
            <td className="text-white font-black tabular-nums">{sig.volume || sig.lots}</td>
            <td className="text-text-main/80 font-bold tabular-nums">
              {sig.fillPrice ? `$${sig.fillPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}` : 'PENDING'}
            </td>
            <td className="text-gray-500 font-bold">
              <div className="flex items-center gap-2">
                <Clock size={12} className="opacity-50" />
                {new Date(sig.time).toLocaleTimeString([], { hour12: false })}
              </div>
            </td>
            <td className="text-right pr-6">
              {sig.fillPrice ? (
                <div className="inline-flex flex-col items-end">
                  <span className="text-[9px] font-black tracking-widest bg-accent-success/10 text-accent-success px-2.5 py-1 rounded-lg border border-accent-success/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                    CONFIRMED_OK
                  </span>
                  {sig.fillTimeMs && <span className="text-[8px] font-black text-gray-700 mt-1">{sig.fillTimeMs}MS_LATENCY</span>}
                </div>
              ) : (
                <span className="text-[9px] font-black tracking-widest bg-accent-warning/10 text-accent-warning px-2.5 py-1 rounded-lg border border-accent-warning/30 animate-pulse">
                  ROUTING_PACKETS
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
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest border ${isBuy ? 'text-accent-success bg-accent-success/10 border-accent-success/20' : 'text-accent-danger bg-accent-danger/10 border-accent-danger/20'}`}>
      <div className={`size-1 rounded-full ${isBuy ? 'bg-accent-success' : 'bg-accent-danger'} animate-glow`} />
      {isBuy ? 'LONG_VECTOR' : 'SHORT_VECTOR'}
    </div>
  );
}

