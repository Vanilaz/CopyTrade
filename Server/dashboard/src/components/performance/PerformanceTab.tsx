import React, { useState, useMemo } from 'react';
import type { DashboardData, AccountPerformance, RiskMetric, EquityPoint } from '../../types/api';
import { 
  BarChart2, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Trash2,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  LineChart,
  Target
} from 'lucide-react';

interface PerformanceTabProps {
  data: DashboardData;
  passcode: string;
}

export function PerformanceTab({ data, passcode }: PerformanceTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'master' | 'slave'>('all');
  const [sortConfig, setSortConfig] = useState<{ key: keyof AccountPerformance | 'drawdownGuard'; dir: 'asc' | 'desc' } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const clearPerformance = async () => {
    if (confirm('AUTHORIZATION REQUIRED: Permanently purge performance telemetry?')) {
      await fetch('/api/performance/clear', {
        method: 'POST',
        headers: { 'Authorization': passcode }
      });
      window.location.reload();
    }
  };

  // Profit Factor Calculation
  const profitFactor = useMemo(() => {
    let grossWin = 0;
    let grossLoss = 0;
    data.history.forEach(t => {
      if (t.profit > 0) grossWin += t.profit;
      else if (t.profit < 0) grossLoss -= t.profit;
    });
    if (grossLoss === 0) return grossWin > 0 ? '99.9' : '0.00';
    return (grossWin / grossLoss).toFixed(2);
  }, [data.history]);

  // Daily Drawdown metrics
  const getDailyDDPercentage = (acct: AccountPerformance) => {
    const startBalance = acct.equity - acct.todayPnL; // Approx start balance of the day
    if (startBalance <= 0) return 0;
    if (acct.todayPnL >= 0) return 0;
    return Math.abs(acct.todayPnL) / startBalance * 100;
  };

  // Filtering & Sorting
  const filteredSortedData = useMemo(() => {
    let result = data.performance.filter(d => {
      if (roleFilter !== 'all' && d.role !== roleFilter) return false;
      if (searchTerm && !d.accountId.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });

    if (sortConfig) {
      result.sort((a, b) => {
        let valA: number | string = a[sortConfig.key as keyof AccountPerformance] as any;
        let valB: number | string = b[sortConfig.key as keyof AccountPerformance] as any;

        if (sortConfig.key === 'drawdownGuard') {
          valA = getDailyDDPercentage(a);
          valB = getDailyDDPercentage(b);
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
           return sortConfig.dir === 'asc' ? valA - valB : valB - valA;
        }
        return sortConfig.dir === 'asc' 
           ? String(valA).localeCompare(String(valB)) 
           : String(valB).localeCompare(String(valA));
      });
    }
    return result;
  }, [data.performance, searchTerm, roleFilter, sortConfig]);

  const requestSort = (key: keyof AccountPerformance | 'drawdownGuard') => {
    setSortConfig(current => {
      if (current?.key === key) {
        if (current.dir === 'desc') return { key, dir: 'asc' };
        return null;
      }
      return { key, dir: 'desc' };
    });
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const Sparkline = ({ points }: { points: EquityPoint[] }) => {
    if (points.length < 2) return <div className="w-16 h-4 opacity-20 bg-white/5 rounded" />;
    
    const minEq = Math.min(...points.map(p => p.equity));
    const maxEq = Math.max(...points.map(p => p.equity));
    const range = maxEq - minEq || 1;
    const isUp = points[points.length-1].equity >= points[0].equity;
    const color = isUp ? 'var(--color-accent-success)' : 'var(--color-accent-danger)';

    const svgPoints = points.map((p, i) => {
      const x = (i / (points.length - 1)) * 64;
      const y = 16 - ((p.equity - minEq) / range) * 16;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="64" height="16" className="overflow-visible">
        <polyline points={svgPoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const totalTrades = data.performance.reduce((sum, d) => sum + (d.totalTrades || 0), 0);

  return (
    <div className="flex flex-col gap-10 animate-in fade-in duration-700">
      <div className="premium-panel overflow-hidden border-accent-primary/20 group">
        <div className="hud-bracket hud-bracket-tl" />
        <div className="hud-bracket hud-bracket-tr" />
        <div className="scanning-line opacity-10" />
        
        {/* Toolbar Header - HUD Style */}
        <div className="p-5 bg-white/[0.02] flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-white/5 relative z-10">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group/search w-full sm:w-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-accent-primary opacity-50 group-focus-within/search:opacity-100 transition-opacity" />
              <input 
                type="text" 
                placeholder="PROBE GATEWAY_ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-[10px] font-black tracking-widest text-white focus:outline-none focus:border-accent-primary/40 focus:bg-black/80 transition-all w-full sm:w-72"
              />
            </div>
            
            <div className="flex items-center bg-black/40 border border-white/5 rounded-xl p-1 gap-1">
              {[
                { id: 'all', label: 'ALL_NODES' },
                { id: 'master', label: 'MASTERS', color: 'text-accent-warning' },
                { id: 'slave', label: 'SLAVES', color: 'text-accent-primary' }
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => setRoleFilter(f.id as any)}
                  className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-[0.2em] transition-all ${roleFilter === f.id ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="size-10 flex items-center justify-center bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] hover:border-white/20 rounded-xl transition-all group/ref">
              <RefreshCw size={14} className="text-gray-400 group-hover/ref:text-accent-primary group-active/ref:rotate-180 transition-all" />
            </button>
            <button 
              onClick={clearPerformance}
              className="h-10 px-5 bg-accent-danger/5 text-accent-danger border border-accent-danger/20 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] flex items-center gap-2.5 hover:bg-accent-danger/20 hover:border-accent-danger/40 transition-all"
            >
              <Trash2 size={12} className="animate-pulse" />
              TERMINATE_METRICS
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-4">
          <table className="data-matrix border-none">
            <thead>
              <tr className="[&>th]:cursor-pointer [&>th]:hover:bg-white/5 border-b border-white/5">
                <th onClick={() => requestSort('accountId')}>
                  <div className="flex items-center gap-2 group/th">
                    <span className="group-hover/th:text-accent-primary transition-colors">IDENTIFIER</span>
                    {sortConfig?.key === 'accountId' && (sortConfig.dir === 'desc' ? <ChevronDown size={10} className="text-accent-primary"/> : <ChevronUp size={10} className="text-accent-primary"/>)}
                  </div>
                </th>
                <th onClick={() => requestSort('role')}>
                  <div className="flex items-center gap-2 group/th">
                    <span className="group-hover/th:text-accent-primary">TYPE</span>
                  </div>
                </th>
                <th onClick={() => requestSort('equity')}>
                  <div className="flex items-center gap-2 group/th">
                    <span className="group-hover/th:text-accent-primary">EQUITY_VAL</span>
                  </div>
                </th>
                <th onClick={() => requestSort('todayPnL')}>
                  <div className="flex items-center gap-2 group/th">
                    <span className="group-hover/th:text-accent-primary">SESSION_PNL</span>
                  </div>
                </th>
                <th className="w-32">
                  <span>TRENDLINE</span>
                </th>
                <th onClick={() => requestSort('drawdownGuard')}>
                  <div className="flex items-center gap-2 group/th">
                    <span className="group-hover/th:text-accent-primary">GUARD_LIMIT</span>
                  </div>
                </th>
                <th onClick={() => requestSort('winRate')}>
                  <div className="flex items-center gap-2 group/th">
                    <span className="group-hover/th:text-accent-primary transition-colors">WIN_RATE</span>
                  </div>
                </th>
                <th className="text-right">
                  <span>CTRL</span>
                </th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs cursor-pointer">
              {filteredSortedData.map((row) => {
                const isExpanded = expandedRows.has(row.accountId);
                const ddPct = getDailyDDPercentage(row);
                // Get risk data if available
                const riskData = data.risk?.find(r => r.accountId === row.accountId);

                return (
                  <React.Fragment key={row.accountId}>
                    <tr onClick={() => toggleRow(row.accountId)} className="hover:bg-white/[0.02] transition-colors border-b border-white/5">
                      <td>
                        <div className="flex items-center gap-3">
                          <div className={`size-2 rounded-full shadow-[0_0_8px_currentColor] ${ddPct >= 4 ? 'bg-accent-danger text-accent-danger animate-pulse' : 'bg-accent-success text-accent-success'}`} />
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
                        <div className={`font-bold ${row.todayPnL >= 0 ? 'text-accent-success' : 'text-accent-danger'}`}>
                          {row.todayPnL >= 0 ? '+' : ''}${(row.todayPnL || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </div>
                      </td>
                      <td className="w-24">
                        <Sparkline points={(data.equityHistory || []).filter(e => e.accountId === row.accountId)} />
                      </td>
                      <td>
                        <div className="flex items-center gap-3 w-28">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full shadow-[0_0_8px_currentColor] ${ddPct >= 4 ? 'bg-accent-danger text-accent-danger' : (ddPct >= 2 ? 'bg-accent-warning text-accent-warning' : 'bg-accent-success text-accent-success')}`} 
                              style={{ width: `${Math.min(100, (ddPct / 5) * 100)}%` }} 
                            />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors">{ddPct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-gray-300">{row.winRate}{row.winRate !== '—' ? '%' : ''}</span>
                        </div>
                      </td>
                      <td className="text-right">
                        <ChevronDown size={14} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </td>
                    </tr>
                    
                    {/* Expandable Sub-Detail Row */}
                    {isExpanded && (
                      <tr className="bg-black/60 border-b border-white/5 border-l-2 border-l-accent-primary z-10 relative">
                        <td colSpan={8} className="p-0">
                          <div className="px-12 py-10 grid grid-cols-1 md:grid-cols-4 gap-10 animate-in fade-in slide-in-from-top-4 duration-300">
                            {/* Deep Metrics HUD Style */}
                            <div className="flex flex-col gap-3 group/sub">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover/sub:text-accent-primary transition-colors">PNL_TIMELINE</span>
                                <div className="size-1 rounded-full bg-accent-primary opacity-20" />
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex flex-col">
                                   <span className="text-[8px] font-bold text-gray-600 uppercase">Week</span>
                                   <span className={`text-xs font-black tabular-nums ${row.weekPnL >= 0 ? "text-accent-success" : "text-accent-danger"}`}>
                                      {row.weekPnL >= 0 ? '+' : ''}{row.weekPnL.toFixed(2)}
                                   </span>
                                </div>
                                <div className="h-6 w-px bg-white/5" />
                                <div className="flex flex-col">
                                   <span className="text-[8px] font-bold text-gray-600 uppercase">Month</span>
                                   <span className={`text-xs font-black tabular-nums ${row.monthPnL >= 0 ? "text-accent-success" : "text-accent-danger"}`}>
                                      {row.monthPnL >= 0 ? '+' : ''}{row.monthPnL.toFixed(2)}
                                   </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-3 group/sub">
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover/sub:text-accent-warning transition-colors">AUDIT_TELEMETRY</span>
                              <div className="flex items-center gap-4 text-[11px] font-black text-white tabular-nums">
                                {riskData ? (
                                  <>
                                    <div className="flex flex-col">
                                       <span className="text-[8px] font-bold text-gray-600 uppercase">Margin</span>
                                       <span className={riskData.marginLevel < 150 ? 'text-accent-danger' : 'text-accent-success'}>{riskData.marginLevel.toFixed(1)}%</span>
                                    </div>
                                    <div className="h-6 w-px bg-white/5" />
                                    <div className="flex flex-col">
                                       <span className="text-[8px] font-bold text-gray-600 uppercase">Free</span>
                                       <span className="text-accent-primary">${riskData.freeMargin.toLocaleString()}</span>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-gray-600 italic animate-pulse">SYNCING_NODE...</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-3 group/sub">
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest group-hover/sub:text-accent-secondary transition-colors">ENGINE_METRICS</span>
                              <div className="flex items-center gap-4 text-[11px] font-black text-white tabular-nums">
                                <div className="flex flex-col">
                                   <span className="text-[8px] font-bold text-gray-600 uppercase">Ops</span>
                                   <span className="text-text-main">{row.totalTrades}</span>
                                </div>
                                <div className="h-6 w-px bg-white/5" />
                                <div className="flex flex-col">
                                   <span className="text-[8px] font-bold text-gray-600 uppercase">Max_DD</span>
                                   <span className="text-accent-danger">{row.maxDrawdownPct}%</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-3 group/sub">
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">ASSET_EXPOSURE</span>
                              <div className="flex flex-wrap gap-2">
                                {riskData && Object.keys(riskData.exposure).length > 0 ? (
                                  Object.entries(riskData.exposure).slice(0, 3).map(([sym, exp], i) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-lg flex items-center gap-2 group/exp">
                                      <span className="text-[9px] font-black text-white">{sym}</span>
                                      <span className="text-[9px] font-black text-accent-primary opacity-60 group-hover/exp:opacity-100">{exp.lots}L</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-gray-700 font-bold uppercase tracking-tighter text-[10px]">No Active Exposure</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              
              {filteredSortedData.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-500 text-xs italic opacity-50">
                    No instances matching telemetry filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capability Cards HUD */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <CapabilityCard 
          icon={<Target size={20} className="text-accent-primary" />} 
          title="Profit Factor Matrix" 
          value={profitFactor} 
          desc="Neural gain/loss coefficients"
          tag="FACT_0.1"
        />
        <CapabilityCard 
          icon={<ShieldCheck size={20} className="text-accent-success" />} 
          title="Security Relay Link" 
          value="Institutional" 
          desc="AES-256 telemetry handshake"
          tag="SEC_88"
        />
        <CapabilityCard 
          icon={<Zap size={20} className="text-accent-warning" />} 
          title="Aggregated Ops" 
          value={totalTrades.toLocaleString()} 
          desc="Cumulative cluster executions"
          tag="LOAD_HI"
        />
      </div>
    </div>
  );
}

function CapabilityCard({ icon, title, value, desc, tag }: any) {
  return (
    <div className="premium-panel p-6 flex items-start gap-6 hover:border-accent-primary/20 transition-all group/cap relative">
      <div className="hud-bracket hud-bracket-tl opacity-0 group-hover/cap:opacity-100 transition-opacity" />
      <div className="size-11 bg-white/[0.04] border border-white/5 rounded-2xl flex items-center justify-center shrink-0 group-hover/cap:bg-accent-primary/10 group-hover/cap:border-accent-primary/20 transition-all duration-500">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-3 mb-2">
           <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest">{title}</div>
           <div className="px-1.5 py-0.5 bg-white/5 rounded text-[8px] font-black text-gray-700">{tag}</div>
        </div>
        <div className="text-terminal text-2xl text-white leading-none mb-2 group-hover/cap:text-accent-primary transition-colors">{value}</div>
        <div className="text-[9px] font-black text-gray-600 uppercase tracking-[0.1em] leading-tight">{desc}</div>
      </div>
      <div className="absolute top-2 right-2 size-1 rounded-full bg-accent-primary opacity-10 animate-pulse" />
    </div>
  );
}
