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
      <aside className="hidden md:flex flex-col w-60 bg-bg-surface/80 backdrop-blur-3xl border-r border-premium z-50 shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="size-10 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center shadow-lg shadow-accent-primary/20 shrink-0">
              <Zap className="text-white size-5 fill-white" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight leading-none text-text-main">{t('nav.title')}</h1>
              <p className="text-[9px] font-black tracking-[0.2em] text-accent-primary uppercase mt-1">{t('nav.version')}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 px-4 py-2 space-y-2 overflow-y-auto">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2 mb-4">Navigation</div>
          
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden ${activeTab === t.id ? 'text-text-main bg-white/[0.05] shadow-sm' : 'text-gray-400 hover:text-text-main hover:bg-white/[0.03]'}`}
            >
              {activeTab === t.id && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent-primary shadow-[0_0_12px_rgba(59,130,246,0.8)]" />
              )}
              <div className={`relative ${activeTab === t.id ? 'text-accent-primary' : ''}`}>
                <t.icon size={18} />
              </div>
              <span className="tracking-wide">{t.name}</span>
            </button>
          ))}
        </div>

        <div className="p-5 border-t border-premium flex flex-col gap-5">
          {/* Connection Status & Timezone */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className={`size-2 rounded-full ${connectionStatus === 'connected' ? 'bg-accent-success shadow-[0_0_8px_#16a34a] animate-pulse' : 'bg-accent-danger shadow-[0_0_8px_#dc2626]'}`} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${connectionStatus === 'connected' ? 'text-accent-success' : 'text-accent-danger'}`}>
                {connectionStatus}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
              <Globe size={10} className="text-gray-400" />
              <span>{t('nav.timezone')}</span>
            </div>
          </div>

          {/* Settings Row: Theme & Lang */}
          <div className="grid grid-cols-2 gap-2">
            {/* Theme Toggle */}
            <div className="flex items-center bg-black/10 dark:bg-white/[0.03] border border-premium p-1 rounded-lg">
              <button onClick={() => setTheme('light')} className={`flex-1 flex justify-center p-1.5 rounded-md transition-colors ${theme === 'light' ? 'bg-white dark:bg-white/10 text-accent-primary shadow-sm' : 'text-gray-400 hover:text-text-main'}`} title={t('theme.light')}>
                <Sun size={14} />
              </button>
              <button onClick={() => setTheme('system')} className={`flex-1 flex justify-center p-1.5 rounded-md transition-colors ${theme === 'system' ? 'bg-white dark:bg-white/10 text-accent-primary shadow-sm' : 'text-gray-400 hover:text-text-main'}`} title={t('theme.system')}>
                <Laptop size={14} />
              </button>
              <button onClick={() => setTheme('dark')} className={`flex-1 flex justify-center p-1.5 rounded-md transition-colors ${theme === 'dark' ? 'bg-white dark:bg-white/10 text-accent-primary shadow-sm' : 'text-gray-400 hover:text-text-main'}`} title={t('theme.dark')}>
                <Moon size={14} />
              </button>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center bg-black/10 dark:bg-white/[0.03] border border-premium p-1 rounded-lg text-xs font-bold font-mono">
              <button onClick={() => i18n.changeLanguage('en')} className={`flex-1 py-1 text-center rounded-md transition-colors ${i18n.language === 'en' ? 'bg-white dark:bg-white/10 text-accent-primary shadow-sm' : 'text-gray-400 hover:text-text-main'}`}>
                EN
              </button>
              <button onClick={() => i18n.changeLanguage('th')} className={`flex-1 py-1 text-center rounded-md transition-colors ${i18n.language === 'th' ? 'bg-white dark:bg-white/10 text-accent-primary shadow-sm' : 'text-gray-400 hover:text-text-main'}`}>
                TH
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Mobile Header (Visible only on small screens) ─── */}
      <header className="md:hidden absolute top-0 left-0 right-0 h-16 bg-bg-surface/80 backdrop-blur-2xl border-b border-premium px-6 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
          <div className="size-8 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-lg flex items-center justify-center">
            <Zap className="text-white size-4 fill-white" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight leading-none">{t('nav.title')}</h1>
            <p className="text-[8px] font-black tracking-[0.2em] text-accent-primary uppercase mt-0.5">{connectionStatus}</p>
          </div>
        </div>

        {/* Mobile Mini Settings */}
        <div className="flex gap-2">
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="p-2 bg-white/[0.05] rounded-lg border border-premium text-gray-400">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={() => i18n.changeLanguage(i18n.language === 'en' ? 'th' : 'en')} className="p-2 bg-white/[0.05] rounded-lg border border-premium text-gray-400 font-mono text-[10px] font-bold">
            {i18n.language.toUpperCase()}
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative pt-20 pb-24 md:pt-6 md:pb-6 px-6 md:px-10">
        <div className="h-full max-w-screen-2xl mx-auto">
          {/* Dashboard Header Info (Desktop) */}
          <div className="hidden md:flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-text-main">{tabs.find(t => t.id === activeTab)?.name}</h2>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Real-time Telemetry Dashboard</p>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'overview' && <OverviewTab data={data} />}
            {activeTab === 'performance' && <PerformanceTab data={data} passcode={passcode} />}
            {activeTab === 'monitor' && <MonitorTab data={data} />}
            {activeTab === 'history' && <HistoryTab data={data.history} />}
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
