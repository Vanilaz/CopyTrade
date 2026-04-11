import { useState, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  Activity, 
  History, 
  LayoutDashboard, 
  Globe, 
  Zap,
  Lock,
  Cpu,
  Loader2
} from 'lucide-react';

import { OverviewTab } from './components/overview/OverviewTab';
import { PerformanceTab } from './components/performance/PerformanceTab';
import { MonitorTab } from './components/monitor/MonitorTab';
import { HistoryTab } from './components/history/HistoryTab';
import type { DashboardData, EquityPoint } from './types/api';

function App() {
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
      setReconnectCount(0); // Reset on success
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
                uptime: prev.stats.uptime
              };
              setIsReady(true);
              break;
            case 'performance': 
              newData.performance = msgData; 
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
              // Instant insert new signal
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
        console.error('[WS] Parse Error:', e);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
    };

    ws.onclose = () => {
      setConnectionStatus('connecting');
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        setReconnectCount(prev => prev + 1);
      }, 3000);
    };

    return () => {
      ws.onclose = null; // Prevent reconnect on manual unmount
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
              <h2 className="text-2xl font-black tracking-tight text-white mb-2">INSTITUTIONAL ACCESS</h2>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Authorized Personnel Only</p>
            </div>
            <input 
              type="password" 
              placeholder="Enter Gateway Key"
              className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-5 text-mono text-center focus:outline-none focus:border-accent-primary/50 transition-all font-bold"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value;
                  setPasscode(val);
                  localStorage.setItem('passcode', val);
                }
              }}
            />
            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Neural Link Encryption Active</p>
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
          <h2 className="text-xl font-black tracking-tighter text-white mb-2 uppercase">Initializing Neural Relay</h2>
          <div className="flex items-center gap-2 justify-center text-[10px] font-black text-gray-500 tracking-[0.3em] uppercase">
            <Loader2 size={12} className="animate-spin text-accent-primary" />
            Synchronizing Terminal Streams...
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'performance', name: 'Performance', icon: BarChart3 },
    { id: 'monitor', name: 'Monitor', icon: Activity },
    { id: 'history', name: 'History', icon: History },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <div className="noise-overlay" />
      
      {/* ─── Top Navigation ─── */}
      <nav className="sticky top-0 z-50 h-16 md:h-20 bg-bg-surface/80 backdrop-blur-2xl border-b border-white/5 px-6 md:px-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="size-10 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-xl flex items-center justify-center shadow-lg shadow-accent-primary/20">
            <Zap className="text-white size-5 fill-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-black tracking-tight leading-none text-white">COPYTRADE PRO</h1>
            <p className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase mt-1">Terminal v3.0 // {connectionStatus.toUpperCase()}</p>
          </div>
        </div>

        {/* Desktop Tabs */}
        <div className="hidden md:flex items-center bg-white/[0.03] border border-white/5 p-1 rounded-xl">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`institutional-tab ${activeTab === t.id ? 'institutional-tab-active' : 'text-gray-500 hover:text-white'}`}
            >
              <t.icon size={16} />
              {t.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg text-[10px] font-black text-gray-400">
            <Globe size={12} className="text-accent-primary" />
            <span>ASIA/BANGKOK</span>
          </div>
          <div className={`status-pill ${connectionStatus === 'connected' ? 'status-pill-online' : 'status-pill-offline'}`}>
            <div className={`size-2 rounded-full bg-current shadow-[0_0_8px_currentColor] ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`} />
            <span>{connectionStatus.toUpperCase()}</span>
          </div>
        </div>
      </nav>

      {/* ─── Main Content ─── */}
      <main className="flex-1 container mx-auto p-6 md:p-10 mb-24 md:mb-10 max-w-screen-2xl">
        <div className="animate-in">
          {activeTab === 'overview' && <OverviewTab data={data} />}
          {activeTab === 'performance' && <PerformanceTab data={data.performance} passcode={passcode} />}
          {activeTab === 'monitor' && <MonitorTab data={data} />}
          {activeTab === 'history' && <HistoryTab data={data.history} />}
        </div>
      </main>

      {/* ─── Mobile Navigation ─── */}
      <div className="md:hidden fixed bottom-6 left-6 right-6 z-50">
        <div className="premium-panel h-16 flex items-center shadow-accent-primary/10">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${activeTab === t.id ? 'text-accent-primary' : 'text-gray-500'}`}
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
