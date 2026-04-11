import type { PositionsData } from '../../types/api';
import { getPnLColor } from '../../utils/format';

interface PositionGridProps {
  data: PositionsData | null;
}

export function PositionGrid({ data }: PositionGridProps) {
  if (!data) {
    return (
      <div className="panel panel-full">
        <div className="panel-header">
          <div className="panel-title">📋 Open Positions</div>
        </div>
        <div className="panel-body">
          <div className="empty-state"><div className="empty-emoji">📋</div>No position data</div>
        </div>
      </div>
    );
  }

  const accountIds = Object.keys(data);
  let totalPositions = 0;
  accountIds.forEach(id => { totalPositions += (data[id]?.details || []).length; });

  return (
    <div className="panel panel-full">
      <div className="panel-header">
        <div className="panel-title">📋 Open Positions</div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {totalPositions} position{totalPositions !== 1 ? 's' : ''} across {accountIds.length} account{accountIds.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="panel-body" style={{ maxHeight: 500 }}>
        {totalPositions === 0 ? (
          <div className="empty-state"><div className="empty-emoji">📭</div>No open positions</div>
        ) : (
          accountIds.map(id => {
            const acct = data[id];
            const details = acct?.details || [];
            if (details.length === 0) return null;

            return (
              <div key={id}>
                {/* Account Header */}
                <div style={{
                  padding: '12px 24px',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div className={`acct-badge ${acct.role}`} style={{ width: 24, height: 24, fontSize: 10 }}>
                    {acct.role === 'master' ? 'M' : 'S'}
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13 }}>{id}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({details.length} positions)</span>
                </div>

                {/* Column Headers */}
                <div className="position-header">
                  <span>Symbol</span>
                  <span>Dir</span>
                  <span>Lots</span>
                  <span>Open Price</span>
                  <span>P&L</span>
                  <span>Swap</span>
                </div>

                {/* Position Rows */}
                {details.map((pos, i) => {
                  const isBuy = String(pos.type || '').toLowerCase().includes('buy');
                  const lots = Number(pos.lots) || 0;
                  const openPrice = Number(pos.openPrice) || 0;
                  const pnl = Number(pos.pnl) || 0;
                  const swap = Number(pos.swap) || 0;
                  return (
                    <div className="position-row" key={`${id}-${i}`}>
                      <span style={{ fontWeight: 700, color: '#fff' }}>{pos.symbol}</span>
                      <span>
                        <span className={isBuy ? 'buy-tag' : 'sell-tag'}>
                          {isBuy ? 'BUY' : 'SELL'}
                        </span>
                      </span>
                      <span>{pos.lots !== undefined ? lots.toFixed(2) : '-'}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {pos.openPrice !== undefined ? openPrice.toFixed(5) : '-'}
                      </span>
                      <span style={{ fontWeight: 600, color: getPnLColor(pnl) }}>
                        {pos.pnl !== undefined ? (pnl >= 0 ? '+' : '') + pnl.toFixed(2) : '-'}
                      </span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {pos.swap !== undefined ? swap.toFixed(2) : '0.00'}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
