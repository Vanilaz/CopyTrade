import type { SyncStatus } from '../../types/api';

interface SyncMonitorProps {
  data: SyncStatus | null;
}

export function SyncMonitor({ data }: SyncMonitorProps) {
  const slaves = data?.slaves || [];
  const masters = data?.masters || {};
  const masterIds = Object.keys(masters);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">🔄 Sync Monitor</div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {masterIds.length}M / {slaves.length}S
        </span>
      </div>
      <div className="panel-body">
        {slaves.length === 0 ? (
          <div className="empty-state">
            <div className="empty-emoji">🔗</div>
            No slaves to monitor sync
          </div>
        ) : (
          slaves.map(s => {
            const masterData = masters[s.subscribedTo] || null;
            return (
              <div className="sync-row" key={s.accountId}>
                <div className={`acct-badge slave`} style={{ width: 32, height: 32, fontSize: 12 }}>S</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                    {s.accountId}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    → {s.subscribedTo || 'ALL'}
                    {' · '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Master: {s.masterPositions} pos
                    </span>
                    {' · '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      Slave: {s.slavePositions} pos
                    </span>
                  </div>
                  {s.missingSymbols && s.missingSymbols.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--accent-danger)', marginTop: 4 }}>
                      ⚠ Missing: {s.missingSymbols.join(', ')}
                    </div>
                  )}
                </div>
                <div>
                  <span className={`sync-badge ${s.synced ? 'synced' : 'out-of-sync'}`}>
                    {s.synced ? '✅ SYNCED' : `❌ -${s.missing}`}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {/* Master Position Summary */}
        {masterIds.length > 0 && (
          <>
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Master Position Details
              </div>
              {masterIds.map(mid => {
                const m = masters[mid];
                return (
                  <div key={mid} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-warning)', marginBottom: 4 }}>
                      ⭐ {mid} ({m.count} positions)
                    </div>
                    {m.details && m.details.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {m.details.map((p, i) => (
                          <span key={i} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 4,
                            background: 'rgba(255,255,255,0.05)',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-secondary)',
                          }}>
                            {p.symbol} {p.lots}L
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No positions</div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
