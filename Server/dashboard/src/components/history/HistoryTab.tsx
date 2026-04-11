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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPIBox 
          icon={<Database size={16} className={realizedProfit >= 0 ? "text-accent-success" : "text-accent-danger"} />}
          title="Net Realized"
          value={`$${Math.abs(realizedProfit).toFixed(2)}`}
          prefix={realizedProfit >= 0 ? '+' : '-'}
          colorClass={realizedProfit >= 0 ? "text-accent-success" : "text-accent-danger"}
        />
        <KPIBox 
          icon={<Target size={16} className={winRate > 50 ? "text-accent-info" : "text-gray-400"} />}
          title="System Win Rate"
          value={`${winRate.toFixed(1)}%`}
          colorClass={winRate > 50 ? "text-accent-info" : "text-gray-300"}
        />
        <KPIBox 
          icon={<Trophy size={16} className="text-accent-warning" />}
          title="Best Trade"
          value={`+$${bestTrade.toFixed(2)}`}
          colorClass="text-accent-warning"
        />
        <KPIBox 
          icon={<AlertTriangle size={16} className="text-accent-danger" />}
          title="Worst Trade"
          value={`-$${Math.abs(worstTrade).toFixed(2)}`}
          colorClass="text-accent-danger"
        />
      </div>

      <div className="premium-panel overflow-hidden flex flex-col">
        <div className="premium-panel-header justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-accent-secondary/20 rounded-lg flex items-center justify-center">
              <Database size={16} className="text-accent-secondary" />
            </div>
            <div>
              <h3 className="premium-title">Institutional Archive</h3>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Historical Execution Stream</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search ticket or symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-accent-secondary/50 transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 bg-black/40 border border-white/5 rounded-lg p-1">
              {(['all', 'buy', 'sell'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${typeFilter === type ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="status-pill bg-white/[0.03] border-white/5 text-gray-400 hidden sm:flex">
              {filteredData.length} RECORDS
            </div>
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

function KPIBox({ icon, title, value, prefix, colorClass }: { icon: any, title: string, value: string, prefix?: string, colorClass: string }) {
  return (
    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex items-center gap-4 hover:bg-white/[0.04] transition-colors">
      <div className="size-10 rounded-xl bg-black/40 border border-white/5 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{title}</div>
        <div className={`font-mono font-bold text-lg leading-none flex items-center ${colorClass}`}>
          {prefix && <span className="opacity-70 mr-0.5">{prefix}</span>}
          {value}
        </div>
      </div>
    </div>
  );
}
