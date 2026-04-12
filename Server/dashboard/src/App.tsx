import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from './contexts/ThemeContext';
import { 
  BarChart3, 
  Activity, 
  History, 
  LayoutDashboard, 
  Globe, 
  Zap,
  Lock,
  Loader2,
  Sun,
  Moon,
  Laptop
} from 'lucide-react';

import { OverviewTab } from './components/overview/OverviewTab';
import { PerformanceTab } from './components/performance/PerformanceTab';
import { MonitorTab } from './components/monitor/MonitorTab';
import { HistoryTab } from './components/history/HistoryTab';
import type { DashboardData, EquityPoint } from './types/api';

function App() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState<DashboardData>({
    stats: { masterCount: 0, slaveCount: 0, uptime: '0s' },
    performance: [],
    signals: [],
    history: [],
    equityHistory: []
  });
  const [isReady, setIsReady] = useState(false);
  const [passcode, setPasscode] = useState(localStorage.getItem('passcode') || '');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [reconnectCount, setReconnectCount] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (passcode === '') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?passcode=${passcode}`;
    
    console.log('[App] Connecting to Neural Relay...');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      setReconnectCount(0);
    };
    
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        const { type, data: msgData } = payload;

        setData(prev => {
          const newData = { ...prev };
          switch (type) {
            case 'status': 
              newData.stats = {
                masterCount: msgData.masters.length,
                slaveCount: msgData.slaves.length,
                uptime: prev.stats.uptime // Backend now sends uptime with perf? No, it used to send with status. If not, we keep prev.
              };
              setIsReady(true);
              break;
            case 'performance': 
              newData.performance = msgData; 
              // uptime usually comes here or we calculate. 
              // Original code: newData.performance = msgData;
              break;
            case 'signalHistory': 
              newData.signals = msgData; 
              break;
            case 'tradeHistory': 
              newData.history = msgData; 
              break;
            case 'sync':
              newData.sync = msgData;
              break;
            case 'risk':
              newData.risk = msgData;
              break;
            case 'signal':
              newData.signals = [msgData, ...prev.signals.slice(0, 49)];
              break;
            case 'equityHistory': {
              const eqArr: EquityPoint[] = [];
              Object.entries(msgData as Record<string, any[]>).forEach(([accountId, snaps]) => {
                snaps.forEach(s => eqArr.push({ time: s.ts, accountId, equity: s.equity }));
              });
              eqArr.sort((a,b) => a.time - b.time);
              newData.equityHistory = eqArr; 
              break;
            }
          }
          return newData;
        });
      } catch (e) {
        // silent catch
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      setConnectionStatus('connecting');
      setTimeout(() => {
        setReconnectCount(prev => prev + 1);
      }, 3000);
    };

    return () => {
      ws.onclose = null;
      ws.close();
    };
  }, [passcode, reconnectCount]);

  // Login Screen
  if (passcode === '') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base px-6">
        <div className="noise-overlay" />
        <div className="premium-panel w-full max-w-md p-8 animate-in">
          <div className="flex flex-col items-center gap-6">
            <div className="size-16 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-2xl flex items-center justify-center shadow-2xl">
              <Lock className="text-white size-8" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black tracking-tight mb-2">{t('login.title')}</h2>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t('login.subtitle')}</p>
            </div>
            <input 
              type="password" 
              placeholder={t('login.placeholder')}
              className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-5 text-mono text-center focus:outline-none focus:border-accent-primary/50 transition-all font-bold"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  setPasscode(val);
                  localStorage.setItem('passcode', val);
                }
              }}
            />
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{t('login.encryption')}</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading Screen
  if (!isReady || connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg-base gap-8">
        <div className="noise-overlay" />
        <div className="relative">
          <div className="size-24 border-4 border-accent-primary/20 border-t-accent-primary rounded-full animate-spin" />
          <Zap className="absolute inset-0 m-auto size-8 text-accent-primary animate-pulse" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black tracking-tighter mb-2 uppercase">{t('loading.title')}</h2>
          <div className="flex items-center gap-2 justify-center text-[10px] font-black text-gray-500 tracking-[0.3em] uppercase">
            <Loader2 size={12} className="animate-spin text-accent-primary" />
            {t('loading.subtitle')}
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: t('nav.overview'), icon: LayoutDashboard },
    { id: 'performance', name: t('nav.performance'), icon: BarChart3 },
    { id: 'monitor', name: t('nav.monitor'), icon: Activity },
    { id: 'history', name: t('nav.history'), icon: History },
  ];

  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      <div className="noise-overlay" />
      
      {/* ─── Desktop Sidebar ─── */}
      <aside className="hidden md:flex flex-col w-64 bg-bg-surface/90 backdrop-blur-3xl z-50 shrink-0 relative">
        {/* Sidebar Background HUD Decor */}
        <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent-primary to-transparent" />
          <div className="absolute bottom-40 left-0 w-full h-px bg-white/10" />
        </div>

        <div className="p-8 relative">
          <div className="flex items-center gap-4">
            <div className="size-11 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)] animate-pulse shrink-0 border border-white/20">
              <Zap className="text-white size-6 fill-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tighter leading-none text-text-main uppercase group-hover:animate-glow">
                COPYTRADE <span className="text-accent-primary">NEURAL</span>
              </h1>
              <p className="text-[10px] font-black tracking-[0.3em] text-gray-500 uppercase mt-1.5 flex items-center gap-1.5 opacity-80">
                <span className="size-1 bg-accent-primary rounded-full animate-ping" />
                SYSTEM V3.0
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-5 py-4 space-y-2 overflow-y-auto custom-scrollbar">
          <div className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em] px-4 mb-6 flex items-center gap-2">
            <div className="w-4 h-px bg-gray-700" />
            Navigation
          </div>
          
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-4 px-5 py-3.5 rounded-xl text-sm font-bold transition-all duration-500 group relative overflow-hidden ${activeTab === t.id ? 'text-text-main bg-white/[0.04] shadow-inner' : 'text-gray-500 hover:text-text-main hover:bg-white/[0.02]'}`}
            >
              {activeTab === t.id && (
                <>
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-primary shadow-[0_0_15px_rgba(59,130,246,1)]" />
                  <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-accent-primary/5 to-transparent" />
                </>
              )}
              <div className={`relative transition-transform duration-500 group-hover:scale-110 ${activeTab === t.id ? 'text-accent-primary' : ''}`}>
                <t.icon size={18} strokeWidth={2.5} />
              </div>
              <span className="tracking-tight">{t.name}</span>
            </button>
          ))}
        </nav>

        <div className="p-6">
          <div className="premium-panel p-5 bg-accent-primary/5 border-accent-primary/10 group cursor-default">
            <div className="hud-bracket hud-bracket-tl opacity-40" />
            <div className="hud-bracket hud-bracket-br opacity-40" />
            <div className="scanning-line opacity-20" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black text-accent-primary uppercase tracking-[0.2em]">Neural Node</p>
                <div className="size-2 rounded-full bg-accent-primary animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              </div>
              <p className="text-[10px] text-gray-400 font-bold leading-relaxed text-terminal italic">
                Scanning liquidity... 
                <br />
                Latency: 1.2ms
              </p>
              <div className="mt-3 h-1 w-full bg-white/[0.03] rounded-full overflow-hidden">
                <div className="h-full bg-accent-primary w-2/3 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <main className="flex-1 flex flex-col min-w-0 bg-bg-base relative">
        {/* Desktop Header / Topbar */}
        <header className="hidden md:flex sticky top-0 h-24 bg-bg-base/40 backdrop-blur-2xl z-40 items-center justify-between px-12 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black tracking-tighter text-text-main flex items-center gap-3">
              {tabs.find(t => t.id === activeTab)?.name}
              <div className="h-4 w-px bg-premium" />
              <span className="text-[10px] font-black text-accent-primary uppercase tracking-[0.3em] opacity-80 pt-1">
                Live Terminal
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-10">
            {/* Status Cluster */}
            <div className="flex items-center gap-8 pr-8">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-3">
                  <div className={`size-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-accent-success shadow-[0_0_10px_#22c55e] animate-pulse' : 'bg-accent-danger shadow-[0_0_10px_#ef4444]'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-[0.2em] animate-glow ${connectionStatus === 'connected' ? 'text-accent-success' : 'text-accent-danger'}`}>
                    {connectionStatus}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] font-black text-gray-500 uppercase tracking-widest mt-1.5 opacity-60">
                  <Globe size={10} strokeWidth={3} />
                  <span>{t('nav.timezone')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Institutional Switchers */}
              <div className="flex items-center bg-black/20 dark:bg-white/[0.02] p-1.5 rounded-2xl gap-1">
                {['light', 'system', 'dark'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setTheme(m as any)}
                    className={`p-2 rounded-xl transition-all duration-300 ${theme === m ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20 scale-110' : 'text-gray-500 hover:text-text-main'}`}
                  >
                    {m === 'light' && <Sun size={15} strokeWidth={2.5} />}
                    {m === 'system' && <Laptop size={15} strokeWidth={2.5} />}
                    {m === 'dark' && <Moon size={15} strokeWidth={2.5} />}
                  </button>
                ))}
              </div>

              <div className="flex items-center bg-black/20 dark:bg-white/[0.02] p-1.5 rounded-2xl text-[11px] font-black font-mono">
                {['en', 'th'].map((l) => (
                  <button
                    key={l}
                    onClick={() => i18n.changeLanguage(l)}
                    className={`px-4 py-2 rounded-xl transition-all duration-300 uppercase ${i18n.language === l ? 'bg-accent-primary text-white shadow-lg shadow-accent-primary/20 scale-110' : 'text-gray-500 hover:text-text-main'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Screen Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-12 relative">
          {/* Subtle Background HUD elements */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-accent-primary/[0.01] pointer-events-none" />
          
          <div className="max-w-screen-2xl mx-auto space-y-12">
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
              {activeTab === 'overview' && <OverviewTab data={data} />}
              {activeTab === 'performance' && <PerformanceTab data={data} passcode={passcode} />}
              {activeTab === 'monitor' && <MonitorTab data={data} />}
              {activeTab === 'history' && <HistoryTab data={data.history} />}
            </div>
          </div>
        </div>
      </main>

      {/* ─── Mobile Bottom Navigation ─── */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-50">
        <div className="premium-panel h-16 flex items-center shadow-accent-primary/10 px-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1.5 transition-colors ${activeTab === t.id ? 'text-accent-primary' : 'text-gray-400 hover:text-text-main'}`}
            >
              <t.icon size={20} className={activeTab === t.id ? 'fill-accent-primary/10' : ''} />
              <span className="text-[9px] font-black uppercase tracking-widest leading-none">{t.id}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
