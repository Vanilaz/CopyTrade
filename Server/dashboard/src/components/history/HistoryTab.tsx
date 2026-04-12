import type { HistoricalTrade } from '../../types/api';
import { 
  Database, 
  ArrowUpRight, 
  ArrowDownRight,
  TrendingDown,
  TrendingUp,
  Clock,
  ExternalLink,
  Target,
  Trophy,
  AlertTriangle,
  Search,
  Filter
} from 'lucide-react';
import { useState, useMemo } from 'react';

interface HistoryTabProps {
  data: HistoricalTrade[];
}

export function HistoryTab({ data }: HistoryTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'buy' | 'sell'>('all');

  const { realizedProfit, winRate, bestTrade, worstTrade } = useMemo(() => {
    if (!data || data.length === 0) return { realizedProfit: 0, winRate: 0, bestTrade: 0, worstTrade: 0 };
    let profit = 0;
    let wins = 0;
    let best = data[0]?.profit ?? 0;
    let worst = data[0]?.profit ?? 0;
    data.forEach(t => {
      const p = t.profit ?? 0;
      profit += p;
      if (p > 0) wins++;
      if (p > best) best = p;
      if (p < worst) worst = p;
    });
    return { 
      realizedProfit: profit, 
      winRate: (wins / data.length) * 100, 
      bestTrade: best, 
      worstTrade: worst 
    };
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(t => {
      const matchSearch = t.ticket.toString().includes(searchTerm) || 
                          t.symbol.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = typeFilter === 'all' || t.type.toLowerCase().includes(typeFilter);
      return matchSearch && matchType;
    });
  }, [data, searchTerm, typeFilter]);

  return (
    <div className="flex flex-col gap-6 animate-in">
      {/* ─── Quantitative Ledger KPIs ─── */}
      {/* ─── Quantitative Ledger Matrix ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPIBox 
          icon={<Database size={18} className={realizedProfit >= 0 ? "text-accent-success" : "text-accent-danger"} />}
          title="Net Realized Matrix"
          value={`$${Math.abs(realizedProfit).toLocaleString(undefined, {minimumFractionDigits: 2})}`}
          prefix={realizedProfit >= 0 ? '+' : '-'}
          colorClass={realizedProfit >= 0 ? "text-accent-success" : "text-accent-danger"}
          tag="REVENUE_NODES"
        />
        <KPIBox 
          icon={<Target size={18} className={winRate > 50 ? "text-accent-primary" : "text-gray-400"} />}
          title="System Hit Rate"
          value={`${winRate.toFixed(1)}%`}
          colorClass={winRate > 50 ? "text-accent-primary" : "text-gray-300"}
          tag="ACCURACY_L3"
        />
        <KPIBox 
          icon={<Trophy size={18} className="text-accent-warning" />}
          title="Alpha Peak Trade"
          value={`+$${bestTrade.toLocaleString(undefined, {minimumFractionDigits: 2})}`}
          colorClass="text-accent-warning"
          tag="MAX_UPSIDE"
        />
        <KPIBox 
          icon={<AlertTriangle size={18} className="text-accent-danger" />}
          title="Max Drawdown Event"
          value={`-$${Math.abs(worstTrade).toLocaleString(undefined, {minimumFractionDigits: 2})}`}
          colorClass="text-accent-danger"
          tag="RISK_EVENT"
        />
      </div>

      <div className="premium-panel overflow-hidden flex flex-col group relative">
        <div className="hud-bracket hud-bracket-tl" />
        <div className="hud-bracket hud-bracket-tr" />
        <div className="scanning-line opacity-10" />
        
        <div className="p-6 bg-white/[0.02] border-b border-white/5 flex flex-col xl:flex-row xl:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="size-10 bg-accent-primary/10 border border-accent-primary/20 rounded-xl flex items-center justify-center animate-pulse">
              <Database size={18} className="text-accent-primary" />
            </div>
            <div>
              <h3 className="premium-title">Institutional Archive Matrix</h3>
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mt-1">TELEMETRY_LOG_V3.0.4</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group/search w-full sm:w-80">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-primary opacity-40 group-focus-within/search:opacity-100 transition-opacity" />
              <input 
                type="text" 
                placeholder="PROBE TICKER OR SYMBOL..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[10px] font-black tracking-widest text-white placeholder:text-gray-700 focus:outline-none focus:border-accent-primary/40 focus:bg-black/80 transition-all"
              />
            </div>
            <div className="flex items-center gap-1 bg-black/40 border border-white/5 rounded-xl p-1">
              {(['all', 'buy', 'sell'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all ${typeFilter === type ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-[9px] font-black text-gray-500 tracking-[0.2em] hidden sm:block">
              {filteredData.length} RECORDS_LOADED
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[650px] overflow-y-auto custom-scrollbar relative">
          <table className="data-matrix w-full">
            <thead className="sticky top-0 z-20 bg-[#0a0a0b] after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px] after:bg-white/5">
              <tr>
                <th>EXECUTION_ID</th>
                <th>SYMBOL</th>
                <th>ENTRY_TYPE</th>
                <th>VOL_LOTS</th>
                <th>ENTRY_PRICE</th>
                <th>REAL_PROFIT</th>
                <th>SETTLEMENT_TS</th>
                <th className="text-right">TELEMETRY</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center opacity-30 italic">
                    <div className="flex flex-col items-center gap-4">
                      <Search size={32} />
                      <span className="uppercase tracking-widest font-black">No Records Match Query</span>
                    </div>
                  </td>
                </tr>
              ) : (
                [...filteredData].reverse().map((trade) => (
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
                    <td className="text-white font-bold">{(trade.volume ?? 0).toFixed(2)}</td>
                    <td className="text-gray-400">${(trade.price ?? 0).toLocaleString()}</td>
                    <td>
                      <div className={`flex items-center gap-1.5 font-black ${(trade.profit ?? 0) >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                        {(trade.profit ?? 0) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        ${Math.abs(trade.profit ?? 0).toLocaleString()}
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

function KPIBox({ icon, title, value, prefix, colorClass, tag }: any) {
  return (
    <div className="premium-panel p-6 flex flex-col gap-5 hover:border-accent-primary/20 transition-all group/kpi relative overflow-hidden">
      <div className="hud-bracket hud-bracket-tl opacity-0 group-hover/kpi:opacity-100 transition-opacity" />
      <div className="scanning-line opacity-0 group-hover/kpi:opacity-5 transition-opacity" />
      
      <div className="flex items-center justify-between">
        <div className="size-11 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover/kpi:bg-white/[0.08] transition-all duration-500">
          {icon}
        </div>
        <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest bg-white/[0.02] px-2 py-1 rounded-lg border border-white/5">{tag}</div>
      </div>
      <div>
        <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1.5">{title}</div>
        <div className={`text-terminal text-2xl leading-none flex items-center group-hover/kpi:scale-105 transition-transform origin-left ${colorClass}`}>
          {prefix && <span className="opacity-50 mr-1 text-lg">{prefix}</span>}
          {value}
        </div>
      </div>
      <div className="absolute top-2 right-2 size-1 rounded-full bg-accent-primary opacity-5 animate-pulse" />
    </div>
  );
}
