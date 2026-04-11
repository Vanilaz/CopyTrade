import type { StatusData, SignalEntry } from '../../types/api';
import { formatCurrency, timeAgo, formatTime, formatUptime, getPnLColor } from '../../utils/format';
import { useState, useEffect } from 'react';

interface OverviewTabProps {
  status: StatusData | null;
  signals: SignalEntry[];
}

export function OverviewTab({ status, signals }: OverviewTabProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - start), 1000);
    return () => clearInterval(timer);
  }, []);

  const masters = status?.masters || [];
  const slaves = status?.slaves || [];

  let totalFloating = 0;
  [...masters, ...slaves].forEach(a => {
    if (a.info?.floatingPnL) totalFloating += a.info.floatingPnL;
  });

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero Stats */}
      <div className="hero-stats">
        <div className="stat-box">
          <div className="stat-title">🟢 Active Masters</div>
          <div className="stat-value">{masters.length}</div>
          <div className="stat-footer">Broadcasting signals</div>
        </div>
        <div className="stat-box">
          <div className="stat-title">🔵 Connected Slaves</div>
          <div className="stat-value">{slaves.length}</div>
          <div className="stat-footer">Following strategies</div>
        </div>
        <div className="stat-box">
          <div className="stat-title">💰 Total Floating</div>
          <div className="stat-value" style={{ color: getPnLColor(totalFloating) }}>
            {formatCurrency(totalFloating)}
          </div>
          <div className="stat-footer">All connected accounts</div>
        </div>
        <div className="stat-box">
          <div className="stat-title">⚡ Total Executions</div>
          <div className="stat-value">{status?.signalCount || 0}</div>
          <div className="stat-footer">All-time executed trades</div>
        </div>
        <div className="stat-box">
          <div className="stat-title">⏱️ System Uptime</div>
          <div className="stat-value">{formatUptime(elapsed)}</div>
          <div className="stat-footer">Zero downtime</div>
        </div>
      </div>

      {/* Master / Slave / Signal Panels */}
      <div className="dashboard-grid">
        {/* Masters */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Master Accounts</div>
          </div>
          <div className="panel-body">
            {masters.length === 0 ? (
              <div className="empty-state"><div className="empty-emoji">📡</div>Waiting for Master terminals</div>
            ) : (
              masters.map(m => (
                <AccountItem key={m.id} id={m.id} role="master"
                  connected={m.connected} lastHeartbeat={m.lastHeartbeat}
                  info={m.info} subscribedTo={undefined} />
              ))
            )}
          </div>
        </div>

        {/* Slaves */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">Slave Accounts</div>
          </div>
          <div className="panel-body">
            {slaves.length === 0 ? (
              <div className="empty-state"><div className="empty-emoji">⏳</div>Waiting for Slave terminals</div>
            ) : (
              slaves.map(s => (
                <AccountItem key={s.id} id={s.id} role="slave"
                  connected={s.connected} lastHeartbeat={s.lastHeartbeat}
                  info={s.info} subscribedTo={s.subscribedTo} />
              ))
            )}
          </div>
        </div>

        {/* Signal Terminal */}
        <div className="panel panel-full">
          <div className="panel-header">
            <div className="panel-title">Execution Terminal</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{signals.length} signals</span>
          </div>
          <div className="panel-body" style={{ maxHeight: 400 }}>
            {signals.length === 0 ? (
              <div className="empty-state"><div className="empty-emoji">📭</div>System idle. Waiting for trade activities.</div>
            ) : (
              [...signals].reverse().slice(0, 100).map((sig, i) => {
                const typeClass = String(sig.type || '').split('_')[0].toLowerCase();
                return (
                  <div className="signal-row" key={`${sig.time}-${i}`}>
                    <div className={`sig-type ${typeClass}`}>{sig.type || 'SYS'}</div>
                    <div className="sig-symbol">{sig.symbol || '—'}</div>
                    <div className="sig-details">
                      <span className="sig-badge">{sig.lots ? sig.lots.toFixed(2) + 'L' : '-'}</span>
                      {sig.fillPrice > 0 && (
                        <span className="sig-badge sig-match">Fill: {sig.fillPrice.toFixed(5)}</span>
                      )}
                      <span>{sig.masterID || ''}</span>
                    </div>
                    <div className="sig-time">
                      <span className="sig-badge">{timeAgo(sig.time)}</span>
                      {' '}{formatTime(sig.time)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Account List Item (shared between Master & Slave) ─── */
interface AccountItemProps {
  id: string;
  role: 'master' | 'slave';
  connected: boolean;
  lastHeartbeat: number;
  info: {
    balance?: number;
    equity?: number;
    floatingPnL?: number;
    positions?: number;
  };
  subscribedTo?: string;
}

function AccountItem({ id, role, connected, lastHeartbeat, info, subscribedTo }: AccountItemProps) {
  const balance = info?.balance ? formatCurrency(info.balance) : '—';
  const equity = info?.equity ? formatCurrency(info.equity) : '—';
  const pnl = info?.floatingPnL || 0;
  const positions = info?.positions ?? '—';

  return (
    <div className="list-item">
      <div className={`avatar ${role}`}>{role === 'master' ? 'M' : 'S'}</div>
      <div className="item-info">
        <div className="item-title">{id}</div>
        <div className="item-sub">
          {role === 'slave' ? `Follow: ${subscribedTo || 'ALL'} · ` : ''}
          Last seen: {timeAgo(lastHeartbeat)} · Pos: {positions}
        </div>
      </div>
      <div className="item-stats">
        <div style={{ color: 'var(--text-secondary)', textAlign: 'left' }}>
          Bal: <span style={{ color: '#fff' }}>{balance}</span>
        </div>
        <div style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>
          Eq: <span style={{ color: '#fff' }}>{equity}</span>
        </div>
        <div style={{ gridColumn: '1 / -1', marginTop: 2, fontWeight: 600, color: getPnLColor(pnl) }}>
          PnL: {formatCurrency(pnl)}
        </div>
      </div>
      <div className={`status-dot ${connected ? 'online' : 'offline'}`} />
    </div>
  );
}
