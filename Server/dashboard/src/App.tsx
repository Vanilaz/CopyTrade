import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { AuthOverlay } from './components/auth/AuthOverlay';
import { OverviewTab } from './components/overview/OverviewTab';
import { PerformanceTab } from './components/performance/PerformanceTab';
import { MonitorTab } from './components/monitor/MonitorTab';
import { HistoryTab } from './components/history/HistoryTab';
import type { TabId } from './types/api';

export default function App() {
  const [passcode, setPasscode] = useState(() => localStorage.getItem('copytrade_passcode') || '');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [tz, setTz] = useState('');

  const ws = useWebSocket(passcode);

  useEffect(() => {
    try {
      setTz(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch { /* ignore */ }
  }, []);

  // Handle auth error — show overlay again
  useEffect(() => {
    if (ws.authError) {
      setPasscode('');
    }
  }, [ws.authError]);

  const handleAuth = (code: string) => {
    localStorage.setItem('copytrade_passcode', code);
    setPasscode(code);
  };

  // Show auth overlay if no passcode
  if (!passcode) {
    return (
      <>
        <div className="ambient-bg" />
        <AuthOverlay onSubmit={handleAuth} error={ws.authError} />
      </>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'performance', label: '🏦 Performance' },
    { id: 'monitor', label: '🖥️ Monitor' },
    { id: 'history', label: '📜 History' },
  ];

  return (
    <>
      <div className="ambient-bg" />

      {/* Navbar */}
      <nav className="navbar">
        <div className="brand">
          <div className="brand-logo">CT</div>
          <div className="brand-text">
            <h1>CopyTrade Pro</h1>
            <span>Fund Management Dashboard</span>
          </div>
        </div>
        <div className="nav-right">
          <div className="timezone-badge">🕑 {tz || 'Local Time'}</div>
          <div className="tab-bar">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className={`status-badge ${ws.connected ? 'connected' : 'disconnected'}`}>
            <div className="pulse-indicator" />
            <span>{ws.connected ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}</span>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container">
        {activeTab === 'overview' && (
          <OverviewTab status={ws.status} signals={ws.signals} />
        )}
        {activeTab === 'performance' && (
          <PerformanceTab data={ws.performance} passcode={passcode} />
        )}
        {activeTab === 'monitor' && (
          <MonitorTab
            sync={ws.sync}
            risk={ws.risk}
            equityHistory={ws.equityHistory}
            positions={ws.positions}
          />
        )}
        {activeTab === 'history' && (
          <HistoryTab data={ws.tradeHistory} />
        )}
      </main>
    </>
  );
}
