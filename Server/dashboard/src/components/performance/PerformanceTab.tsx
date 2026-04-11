import type { AccountPerformance } from '../../types/api';
import { formatCurrency, formatPnL } from '../../utils/format';

interface PerformanceTabProps {
  data: AccountPerformance[];
  passcode: string;
}

export function PerformanceTab({ data, passcode }: PerformanceTabProps) {
  const sorted = [...data].sort((a, b) => {
    if (a.role === 'master' && b.role !== 'master') return -1;
    if (a.role !== 'master' && b.role === 'master') return 1;
    return (b.balance || 0) - (a.balance || 0);
  });

  let totalAum = 0, totalTrades = 0, totalWins = 0;
  data.forEach(a => {
    totalAum += a.equity || 0;
    totalTrades += a.totalTrades || 0;
    totalWins += a.winTrades || 0;
  });

  const avgWinRate = totalTrades > 0 ? ((totalWins / totalTrades) * 100).toFixed(1) + '%' : '—';

  const resetStats = async () => {
    if (!confirm('Reset ALL account statistics (drawdown, win/loss, PnL)?\nThis cannot be undone!')) return;
    try {
      const r = await fetch(`/api/reset-performance?passcode=${passcode}`);
      const d = await r.json();
      if (d.ok) {
        alert('Stats reset successfully!');
        location.reload();
      }
    } catch (e) {
      alert('Reset failed: ' + (e instanceof Error ? e.message : e));
    }
  };

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Summary Cards */}
      <div className="perf-summary">
        <div className="perf-card">
          <div className="perf-card-label">📈 Total Accounts</div>
          <div className="perf-card-value">{data.length}</div>
          <div className="perf-card-sub">Master + Slave connected</div>
        </div>
        <div className="perf-card">
          <div className="perf-card-label">💰 Total AUM</div>
          <div className="perf-card-value">{formatCurrency(totalAum)}</div>
          <div className="perf-card-sub">Assets Under Management</div>
        </div>
        <div className="perf-card">
          <div className="perf-card-label">🎯 Avg Win Rate</div>
          <div className="perf-card-value">{avgWinRate}</div>
          <div className="perf-card-sub">Across all accounts</div>
        </div>
        <div className="perf-card">
          <div className="perf-card-label">📊 Total Trades</div>
          <div className="perf-card-value">{totalTrades}</div>
          <div className="perf-card-sub">All-time closed trades</div>
        </div>
        <div className="perf-card" style={{ cursor: 'pointer', border: '1px solid rgba(239,68,68,0.3)' }}
          onClick={resetStats} title="Reset all drawdown, win/loss, and PnL stats">
          <div className="perf-card-label">🔄 Reset Stats</div>
          <div className="perf-card-value" style={{ fontSize: 18, color: 'var(--accent-warning)' }}>Click to Reset</div>
          <div className="perf-card-sub">Clear all drawdown & trade data</div>
        </div>
      </div>

      {/* Performance Table */}
      <div className="perf-table-container">
        <table className="perf-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Account</th>
              <th>Balance</th>
              <th>Today P&L</th>
              <th>Week P&L</th>
              <th>Month P&L</th>
              <th>Floating</th>
              <th>Win / Loss</th>
              <th>Win Rate</th>
              <th>Drawdown</th>
              <th>Positions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>🏦</div>
                  Waiting for account data...
                </td>
              </tr>
            ) : (
              sorted.map(acct => <PerfRow key={acct.accountId} acct={acct} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PerfRow({ acct }: { acct: AccountPerformance }) {
  const badgeCls = acct.role === 'master' ? 'master' : 'slave';
  const badgeLetter = acct.role === 'master' ? 'M' : 'S';
  const winPct = acct.totalTrades > 0 ? ((acct.winTrades / acct.totalTrades) * 100) : 0;
  const winRateStr = acct.totalTrades > 0 ? winPct.toFixed(1) + '%' : '—';
  const maxDDPct = parseFloat(acct.maxDrawdownPct) || 0;
  const curDDPct = parseFloat(acct.currentDD) || 0;

  const todayPnl = formatPnL(acct.todayPnL);
  const weekPnl = formatPnL(acct.weekPnL);
  const monthPnl = formatPnL(acct.monthPnL);
  const floating = formatPnL(acct.floating);

  return (
    <tr>
      <td>
        <div className="acct-cell">
          <div className={`acct-badge ${badgeCls}`}>{badgeLetter}</div>
          <div>
            <div className="acct-name">{acct.accountId}</div>
            <div className="acct-role">{acct.role}</div>
          </div>
        </div>
      </td>
      <td>{formatCurrency(acct.balance)}</td>
      <td><span className={todayPnl.className}>{todayPnl.text}</span></td>
      <td><span className={weekPnl.className}>{weekPnl.text}</span></td>
      <td><span className={monthPnl.className}>{monthPnl.text}</span></td>
      <td><span className={floating.className}>{floating.text}</span></td>
      <td style={{ fontSize: 13 }}>
        <span className="pnl-positive">{acct.winTrades}W</span>
        <span style={{ color: 'var(--text-muted)', margin: '0 2px' }}>/</span>
        <span className="pnl-negative">{acct.lossTrades}L</span>
      </td>
      <td>
        <div className="winrate-cell">
          <span>{winRateStr}</span>
          <div className="winrate-bar-bg">
            <div className="winrate-bar" style={{ width: `${winPct}%` }} />
          </div>
        </div>
      </td>
      <td className="dd-cell">
        {maxDDPct > 0 ? (
          <>
            <div style={{ fontSize: 14 }}>-{maxDDPct}%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>now: -{curDDPct.toFixed(1)}%</div>
          </>
        ) : (
          <div style={{ color: 'var(--text-muted)' }}>0%</div>
        )}
      </td>
      <td style={{ color: 'var(--text-secondary)' }}>{acct.positions}</td>
    </tr>
  );
}
