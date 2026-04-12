import { useState, useEffect } from 'react';
import type { DashboardData, AccountPerformance, SignalEntry } from '../../types/api';
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock,
  Terminal,
  Signal,
  CreditCard,
  Cpu,
  Crown,
  Target,
  BarChart2,
  Database
} from 'lucide-react';
import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OverviewTabProps {
  data: DashboardData | null;
}

function LiveValue({ value, highlight }: { value: string | number, highlight?: 'success' | 'danger' }) {
  const [prevValue, setPrevValue] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value > prevValue) setFlash('up');
    else if (value < prevValue) setFlash('down');
    
    setPrevValue(value);
    const timer = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <span className={`${flash === 'up' ? 'animate-flash-up' : flash === 'down' ? 'animate-flash-down' : ''} transition-colors duration-200`}>
      {value}
    </span>
  );
}

export function OverviewTab({ data }: OverviewTabProps) {
  if (!data) return null;

  const floatingTotal = data.performance.reduce((sum: number, a: AccountPerformance) => sum + (a.floating || 0), 0);
  const totalSignals = data.signals?.length || 0;
  
  const history = data.history || [];
  const realizedTotal = history.reduce((sum, t) => sum + (t.profit || 0), 0);
  const winningTrades = history.filter(t => t.profit > 0).length;
  const winRate = history.length > 0 ? (winningTrades / history.length) * 100 : 0;

  const masters = data.performance.filter((a: AccountPerformance) => a.role === 'master');
  const slaves = data.performance.filter((a: AccountPerformance) => a.role === 'slave');

  const topMaster = masters.length > 0 ? masters.reduce((p, c) => (p.floating > c.floating ? p : c)) : null;
  const topSlave = slaves.length > 0 ? slaves.reduce((p, c) => (p.floating > c.floating ? p : c)) : null;

  const pnlBySymbol = useMemo(() => {
    const map = new Map<string, number>();
    history.forEach(t => {
      map.set(t.symbol, (map.get(t.symbol) || 0) + t.profit);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a,b) => b.value - a.value)
      .slice(0, 8); // Top 8 symbols
  }, [history]);

  return (
    <div className="flex flex-col gap-10">
      {/* ─── Global Telemetry Matrix ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-5">
        <StatCard 
          icon={<Users size={18} className="text-accent-primary" />} 
          title="Masters Online" 
          value={data.stats.masterCount} 
          subtitle="Broadcasting nodes" 
        />
        <StatCard 
          icon={<UserCheck size={18} className="text-accent-secondary" />} 
          title="Slaves Online" 
          value={data.stats.slaveCount} 
          subtitle="Executing nodes" 
        />
        <StatCard 
          icon={floatingTotal >= 0 ? <TrendingUp size={18} className="text-accent-success" /> : <TrendingDown size={18} className="text-accent-danger" />} 
          title="Total Floating" 
          value={<LiveValue value={`${floatingTotal >= 0 ? '+' : ''}$${floatingTotal.toFixed(2)}`} highlight={floatingTotal < 0 ? 'danger' : 'success'} />} 
          subtitle="Across all accounts" 
          highlight={floatingTotal < 0 ? 'danger' : 'success'}
        />
        <StatCard 
          icon={<Signal size={18} className="text-accent-primary" />} 
          title="Session Signals" 
          value={<LiveValue value={totalSignals} />} 
          subtitle="Real-time stream" 
        />
        <StatCard 
          icon={<Clock size={18} className="text-gray-400" />} 
          title="Core Uptime" 
          value={data.stats.uptime} 
          subtitle={
            <div className="flex items-center gap-1.5 text-accent-success">
              <div className="size-1 rounded-full bg-accent-success animate-ping" />
              ENGINE ACTIVE
            </div>
          } 
        />
        <StatCard 
          icon={<Target size={18} className={winRate >= 50 ? 'text-accent-success' : 'text-accent-warning'} />} 
          title="System Win Rate" 
          value={<LiveValue value={`${winRate.toFixed(1)}%`} highlight={winRate >= 50 ? 'success' : 'danger'} />} 
          subtitle={`On ${history.length} ops`} 
        />
        <StatCard 
          icon={<Database size={18} className={realizedTotal >= 0 ? 'text-accent-success' : 'text-accent-danger'} />} 
          title="Realized PnL" 
          value={<LiveValue value={`${realizedTotal >= 0 ? '+' : ''}$${realizedTotal.toFixed(2)}`} highlight={realizedTotal < 0 ? 'danger' : 'success'} />} 
          subtitle="Closed total" 
          highlight={realizedTotal < 0 ? 'danger' : 'success'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Symbol Volume Distribution */}
        <div className="premium-panel flex flex-col h-[480px] lg:col-span-4 group">
          <div className="hud-bracket hud-bracket-tl" />
          <div className="hud-bracket hud-bracket-tr" />
          <div className="scanning-line opacity-10" />
          
          <div className="premium-panel-header">
            <h3 className="premium-title"><BarChart2 size={14} /> Result by Symbol</h3>
            <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter">DATASET_V3</span>
          </div>
          <div className="flex-1 p-6">
            {pnlBySymbol.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlBySymbol} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={70} 
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 900 }} 
                    axisLine={false} tickLine={false} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'rgba(59,130,246,0.05)' }} 
                    contentStyle={{ backgroundColor: '#020408', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ fontSize: '10px', fontWeight: 900 }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16}>
                    {pnlBySymbol.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value >= 0 ? 'var(--color-accent-success)' : 'var(--color-accent-danger)'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4">
                <BarChart2 size={40} strokeWidth={1} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-center">Awaiting Market Cycle...</span>
              </div>
            )}
          </div>
        </div>

        {/* Master Node Cluster */}
        <div className="premium-panel flex flex-col h-[480px] lg:col-span-4 group">
          <div className="hud-bracket hud-bracket-tl" />
          <div className="hud-bracket hud-bracket-tr" />
          <div className="scanning-line opacity-10" />
          
          <div className="premium-panel-header">
            <h3 className="premium-title"><Terminal size={14} className="text-accent-secondary" /> Master Node Cluster</h3>
            <div className="flex items-center gap-2">
               <div className="size-1.5 rounded-full bg-accent-success animate-pulse" />
               <span className="text-[10px] font-black text-white">{masters.length}</span>
            </div>
          </div>
          <div className="premium-body flex-1 overflow-y-auto p-5 flex flex-col gap-4 custom-scrollbar">
            {masters.map((acct: AccountPerformance) => (
              <AccountItem key={acct.accountId} acct={acct} isTop={topMaster?.accountId === acct.accountId && masters.length > 1} />
            ))}
          </div>
        </div>

        {/* Slave Execution Cluster */}
        <div className="premium-panel flex flex-col h-[480px] lg:col-span-4 group">
          <div className="hud-bracket hud-bracket-tl" />
          <div className="hud-bracket hud-bracket-tr" />
          <div className="scanning-line opacity-10" />
          
          <div className="premium-panel-header">
            <h3 className="premium-title"><Cpu size={14} /> Slave Execution Cluster</h3>
            <div className="flex items-center gap-2">
               <div className="size-1.5 rounded-full bg-accent-primary animate-pulse" />
               <span className="text-[10px] font-black text-white">{slaves.length}</span>
            </div>
          </div>
          <div className="premium-body flex-1 overflow-y-auto p-5 flex flex-col gap-4 custom-scrollbar">
            {slaves.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20 gap-4">
                <Database size={40} strokeWidth={1} />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-center text-accent-primary">No Active Nodes</span>
              </div>
            ) : (
              slaves.map((acct: AccountPerformance) => (
                <AccountItem key={acct.accountId} acct={acct} isTop={topSlave?.accountId === acct.accountId && slaves.length > 1} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Execution Stream HUD */}
      <div className="premium-panel group">
        <div className="hud-bracket hud-bracket-tl" />
        <div className="hud-bracket hud-bracket-tr" />
        <div className="scanning-line opacity-5" />
        
        <div className="premium-panel-header">
          <h3 className="premium-title"><Activity size={14} className="animate-pulse" /> Neural Execution Stream</h3>
          <span className="text-[9px] font-black text-accent-primary uppercase tracking-[0.2em] animate-glow">Live Feed</span>
        </div>
        <div className="bg-black/40 p-8 min-h-[160px] font-mono text-[11px] leading-relaxed relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5">
            <div className="grid grid-cols-12 gap-2 h-full">
              {Array.from({ length: 48 }).map((_, i) => (
                <div key={i} className="h-full border-r border-white/10" />
              ))}
            </div>
          </div>
          
          {data.signals && data.signals.length > 0 ? (
            [...data.signals].reverse().slice(0, 5).map((sig: SignalEntry, i: number) => (
              <div key={i} className="flex items-center gap-6 mb-3 animate-in fade-in slide-in-from-left-4 last:mb-0 group/log">
                <span className="text-gray-600 font-bold tabular-nums">[{new Date(sig.time).toLocaleTimeString()}]</span>
                <span className="w-1.5 h-1.5 rounded-full bg-accent-primary shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                <span className="text-accent-primary font-black uppercase tracking-tighter w-24">{sig.masterID}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${sig.type === 'BUY' ? 'bg-accent-success/20 text-accent-success' : 'bg-accent-danger/20 text-accent-danger'}`}>
                   {sig.type}
                </span>
                <span className="text-text-main font-black tracking-tight">{sig.symbol}</span>
                <span className="text-gray-500 font-bold">@ {sig.fillPrice?.toFixed(5) || 'EXECUTING'}</span>
                <div className="flex-1 border-b border-white/[0.03] border-dotted" />
                <span className="text-[9px] font-black text-gray-700 uppercase">TELEMETRY_DONE</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-4 text-gray-600 italic font-bold">
              <div className="size-2 rounded-full bg-accent-primary animate-ping" />
              SYNCHRONIZING WITH MARKET TELEMETRY...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, subtitle, highlight }: any) {
  return (
    <div className="premium-panel p-6 flex flex-col gap-6 hover:border-accent-primary/30 transition-all group/card">
      <div className="hud-bracket hud-bracket-tl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
      <div className="hud-bracket hud-bracket-br opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
      <div className="scanning-line opacity-0 group-hover/card:opacity-5 transition-opacity" />
      
      <div className="flex items-center justify-between relative z-10">
        <div className="size-11 bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-center group-hover/card:scale-110 group-hover/card:bg-accent-primary/10 group-hover/card:border-accent-primary/20 transition-all duration-500">
          {icon}
        </div>
        <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest leading-none bg-white/[0.02] px-2.5 py-1.5 rounded-lg border border-white/5">UNIT_{Math.floor(Math.random() * 99)}</div>
      </div>
      <div className="relative z-10">
        <div className={`text-2xl text-terminal mb-1 truncate ${highlight === 'danger' ? 'text-accent-danger' : highlight === 'success' ? 'text-accent-success' : 'text-text-main'}`}>
          {value}
        </div>
        <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{title}</div>
      </div>
      <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest border-t border-white/5 pt-4 relative z-10">
        {subtitle}
      </div>
    </div>
  );
}

function AccountItem({ acct, isTop }: { acct: any, isTop?: boolean }) {
  const isMaster = acct.role === 'master';
  return (
    <div className={`relative p-5 bg-white/[0.02] border ${isTop ? 'border-accent-success/40 bg-accent-success/[0.02]' : 'border-white/5'} rounded-xl flex items-center justify-between hover:bg-white/[0.05] transition-all duration-500 overflow-hidden group/item`}>
      <div className="hud-bracket hud-bracket-tl opacity-0 group-hover/item:opacity-100 transition-opacity" />
      <div className="hud-bracket hud-bracket-br opacity-0 group-hover/item:opacity-100 transition-opacity" />
      
      {isTop && (
        <div className="absolute -top-3 -right-3 size-12 opacity-10 group-hover/item:opacity-30 transition-opacity">
           <Crown size={48} className="text-accent-success" />
        </div>
      )}
      <div className="flex items-center gap-5 z-10">
        <div className={`size-10 rounded-xl flex items-center justify-center font-black text-[11px] shadow-sm transition-transform group-hover/item:scale-110 ${isMaster ? 'bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/30' : 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'}`}>
          {isMaster ? 'MST' : 'SLV'}
        </div>
        <div>
          <div className="text-terminal text-white text-base leading-none mb-1.5 flex items-center gap-2 group-hover/item:text-accent-primary transition-colors">
            {acct.accountId}
          </div>
          <div className={`text-[9px] font-black uppercase tracking-[0.2em] ${isTop ? 'text-accent-success' : 'text-gray-600'}`}>
            {isTop ? 'ELITE_PERFORMER' : 'ACTIVE_NODE'}
          </div>
          {!isMaster && acct.subscribedTo && (
            <div className="flex items-center gap-1 mt-1">
              <span className="text-[8px] font-black text-accent-primary uppercase tracking-tighter opacity-70">FOLLOWING:</span>
              <span className="text-[9px] font-black text-white/50 uppercase tracking-tighter tabular-nums bg-white/5 px-1.5 py-0.5 rounded border border-white/5">MST_{acct.subscribedTo}</span>
            </div>
          )}
        </div>
      </div>
      <div className="text-right z-10 flex flex-col items-end">
        <div className="text-terminal text-text-main text-xs leading-none mb-1.5 opacity-90">${acct.equity?.toLocaleString()}</div>
        <div className={`px-2 py-0.5 rounded text-[9px] font-black tabular-nums border ${acct.floating >= 0 ? 'bg-accent-success/10 text-accent-success border-accent-success/20' : 'bg-accent-danger/10 text-accent-danger border-accent-danger/20'}`}>
          {acct.floating >= 0 ? '+' : ''}${acct.floating?.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
