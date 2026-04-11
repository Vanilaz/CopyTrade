import type { RiskMetric } from '../../types/api';
import { formatCurrency, getPnLColor } from '../../utils/format';

interface RiskDashboardProps {
  data: RiskMetric[];
}

export function RiskDashboard({ data }: RiskDashboardProps) {
  const riskData = data || [];
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">⚠️ Risk Dashboard</div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{riskData.length} accounts</span>
      </div>
      <div className="panel-body">
        {riskData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🛡️</div>
            No risk data available
          </div>
        ) : (
          riskData.map(r => {
            const marginPct = parseFloat(r.marginUsagePct) || 0;
            const riskClass = marginPct < 10 ? 'risk-low' : marginPct < 30 ? 'risk-mid' : 'risk-high';
            const marginLevelColor = r.marginLevel > 500 ? 'var(--accent-success)'
              : r.marginLevel > 200 ? 'var(--accent-warning)' : 'var(--accent-danger)';
            const exposureKeys = Object.keys(r.exposure || {});

            return (
              <div key={r.accountId} style={{
                padding: '16px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div className={`acct-badge ${r.role}`} style={{ width: 28, height: 28, fontSize: 11 }}>
                    {r.role === 'master' ? 'M' : 'S'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>
                      {r.accountId}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {r.positions} pos
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    <span style={{ color: marginLevelColor, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {r.marginLevel > 0 ? r.marginLevel.toFixed(0) + '%' : '∞'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>margin</span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px 16px', fontSize: 12 }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Balance</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatCurrency(r.balance)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Free Margin</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{formatCurrency(r.freeMargin)}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)' }}>Floating P&L</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: getPnLColor(r.floatingPnL) }}>
                      {formatCurrency(r.floatingPnL)}
                    </div>
                  </div>
                </div>

                {/* Margin Usage Bar */}
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Margin Usage</span>
                    <span>{marginPct}%</span>
                  </div>
                  <div className="risk-meter">
                    <div className={`risk-meter-fill ${riskClass}`} style={{ width: `${Math.min(marginPct, 100)}%` }} />
                  </div>
                </div>

                {/* Symbol Exposure */}
                {exposureKeys.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Exposure by Symbol</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {exposureKeys.map(sym => {
                        const exp = r.exposure[sym];
                        return (
                          <span key={sym} style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 4,
                            background: 'rgba(255,255,255,0.05)',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: 4,
                          }}>
                            <span style={{ fontWeight: 700 }}>{sym}</span>
                            <span>{exp.lots.toFixed(2)}L</span>
                            <span style={{ color: getPnLColor(exp.pnl) }}>
                              {exp.pnl >= 0 ? '+' : ''}{exp.pnl.toFixed(2)}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
