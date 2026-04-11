import type { SignalEntry } from '../../types/api';
import { formatTime } from '../../utils/format';

interface HistoryTabProps {
  data: SignalEntry[];
}

export function HistoryTab({ data }: HistoryTabProps) {
  return (
    <div className="animate-in">
      <div className="perf-table-container">
        <table className="perf-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Time</th>
              <th>Account</th>
              <th>Role</th>
              <th>Symbol</th>
              <th>Type</th>
              <th>Lots</th>
              <th>Fill Price</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>📜</div>
                  No closed trades yet.
                </td>
              </tr>
            ) : (
              data.map((row, i) => {
                const typeClass = String(row.type || '').split('_')[0].toLowerCase();
                return (
                  <tr key={`${row.time}-${i}`}>
                    <td style={{ textAlign: 'left', paddingLeft: 24 }}>{formatTime(row.time)}</td>
                    <td>{row.masterID}</td>
                    <td>
                      <div className="acct-badge master" style={{ width: 24, height: 24, fontSize: 11 }}>M</div>
                    </td>
                    <td><span className="sig-symbol">{row.symbol || '—'}</span></td>
                    <td>
                      <span className={`sig-type ${typeClass}`}>
                        {(row.type || '').replace('SIGNAL_', '')}
                      </span>
                    </td>
                    <td>{row.lots ? row.lots.toFixed(2) + 'L' : '-'}</td>
                    <td style={{ paddingRight: 24 }}>{row.fillPrice ? row.fillPrice.toFixed(5) : '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
