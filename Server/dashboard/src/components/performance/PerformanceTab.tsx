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
    <div className="flex flex-col gap-8 animate-in">
      <div className="premium-panel overflow-hidden border-accent-primary/20">
        
        {/* Toolbar Header */}
        <div className="p-4 bg-accent-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search Gateway ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-black/40 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-accent-primary/50 transition-colors w-full sm:w-64 z-10"
              />
            </div>
            
            <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-1 z-10">
              <button 
                onClick={() => setRoleFilter('all')}
                className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-colors ${roleFilter === 'all' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
              >
                All Nodes
              </button>
              <button 
                onClick={() => setRoleFilter('master')}
                className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-colors ${roleFilter === 'master' ? 'bg-accent-warning/20 text-accent-warning' : 'text-gray-500 hover:text-white'}`}
              >
                Masters
              </button>
              <button 
                onClick={() => setRoleFilter('slave')}
                className={`px-3 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-colors ${roleFilter === 'slave' ? 'bg-accent-info/20 text-accent-info' : 'text-gray-500 hover:text-white'}`}
              >
                Slaves
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 group">
              <RefreshCw size={14} className="group-active:rotate-180 transition-transform" />
            </button>
            <button 
              onClick={clearPerformance}
              className="px-4 h-9 bg-accent-danger/15 text-accent-danger border border-accent-danger/20 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-accent-danger/20 transition-all font-sans"
            >
              <Trash2 size={12} />
              Purge History
            </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-4">
          <table className="data-matrix border-none">
            <thead>
              <tr className="[&>th]:cursor-pointer [&>th]:hover:bg-white/5 [&>th]:transition-colors">
                <th onClick={() => requestSort('accountId')}>
                  <div className="flex items-center gap-2">Identifier {sortConfig?.key === 'accountId' && (sortConfig.dir === 'desc' ? <ChevronDown size={12}/> : <ChevronUp size={12}/>)}</div>
                </th>
                <th onClick={() => requestSort('role')}>Role</th>
                <th onClick={() => requestSort('equity')}>Equity (USD)</th>
                <th onClick={() => requestSort('todayPnL')}>Today PnL</th>
                <th>Trend</th>
                <th onClick={() => requestSort('drawdownGuard')}>Daily Guard (5%)</th>
                <th onClick={() => requestSort('winRate')}>Win Rate</th>
                <th className="text-right">Actions</th>
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
                      <tr className="bg-black/20 border-b border-white/5">
                        <td colSpan={8} className="p-0">
                          <div className="px-10 py-6 grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-200">
                            {/* Deep Metrics */}
                            <div className="flex flex-col gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-lg border-l-2 border-l-accent-primary">
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Global PnL (Week / Month)</span>
                              <div className="flex items-center gap-2 text-xs font-bold text-white">
                                <span className={row.weekPnL >= 0 ? "text-accent-success" : "text-accent-danger"}>{row.weekPnL >= 0 ? '+' : ''}{row.weekPnL.toFixed(2)}</span>
                                <span className="text-gray-600">/</span>
                                <span className={row.monthPnL >= 0 ? "text-accent-success" : "text-accent-danger"}>{row.monthPnL >= 0 ? '+' : ''}{row.monthPnL.toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-lg border-l-2 border-l-accent-warning">
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Margin Auditor</span>
                              <div className="flex items-center gap-2 text-xs font-bold text-white">
                                {riskData ? (
                                  <>
                                    <span>Lvl: <span className={riskData.marginLevel < 150 ? 'text-accent-danger' : 'text-accent-success'}>{riskData.marginLevel.toFixed(1)}%</span></span>
                                    <span className="text-gray-600">|</span>
                                    <span>Free: ${riskData.freeMargin.toLocaleString()}</span>
                                  </>
                                ) : (
                                  <span className="text-gray-500 italic">Syncing...</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-lg border-l-2 border-l-accent-secondary">
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Trading Metrics</span>
                              <div className="flex items-center gap-2 text-xs font-bold text-white">
                                <span>Trades: {row.totalTrades}</span>
                                <span className="text-gray-600">|</span>
                                <span>Max DD: <span className="text-accent-danger">{row.maxDrawdownPct}%</span></span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-lg">
                              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Symbol Exposure</span>
                              <div className="flex items-center gap-2 text-[10px] font-bold">
                                {riskData && Object.keys(riskData.exposure).length > 0 ? (
                                  Object.entries(riskData.exposure).slice(0, 3).map(([sym, exp], i) => (
                                    <span key={i} className="bg-white/5 px-2 py-0.5 rounded text-gray-300">{sym} ({exp.lots})</span>
                                  ))
                                ) : (
                                  <span className="text-gray-600">No Active Positions</span>
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

      {/* Capability Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CapabilityCard 
          icon={<Target className="text-accent-primary" />} 
          title="System Profit Factor" 
          value={profitFactor} 
          desc="Gross Gain / Gross Loss Ratio"
        />
        <CapabilityCard 
          icon={<ShieldCheck className="text-accent-success" />} 
          title="Security Relay" 
          value="Institutional" 
          desc="Neural link encryption status"
        />
        <CapabilityCard 
          icon={<Zap className="text-accent-warning" />} 
          title="Total Executions" 
          value={totalTrades.toLocaleString()} 
          desc="Aggregated terminal executions"
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
