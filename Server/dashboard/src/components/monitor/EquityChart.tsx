import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { EquityHistoryData } from '../../types/api';

interface EquityChartProps {
  data: EquityHistoryData | null;
}

// Account-specific line colors
const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#0ea5e9', '#ec4899', '#14b8a6'];

export function EquityChart({ data }: EquityChartProps) {
  const { chartData, accountIds } = useMemo(() => {
    if (!data || Object.keys(data).length === 0) {
      return { chartData: [], accountIds: [] };
    }

    const ids = Object.keys(data);

    // Collect all timestamps
    const tsSet = new Set<number>();
    ids.forEach(id => {
      (data[id] || []).forEach(snap => tsSet.add(snap.ts));
    });

    const sortedTs = Array.from(tsSet).sort((a, b) => a - b);

    // Build merged data points
    const merged = sortedTs.map(ts => {
      const point: Record<string, number | string> = {
        ts,
        time: new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
      };

      ids.forEach(id => {
        const snapshots = data[id] || [];
        // Find nearest snapshot at or before this timestamp
        let nearest = null;
        for (let i = snapshots.length - 1; i >= 0; i--) {
          if (snapshots[i].ts <= ts) { nearest = snapshots[i]; break; }
        }
        if (nearest) {
          point[`eq_${id}`] = nearest.equity;
          point[`bal_${id}`] = nearest.balance;
        }
      });

      return point;
    });

    // Downsample if too many points
    const maxPoints = 200;
    let result = merged;
    if (merged.length > maxPoints) {
      const step = Math.ceil(merged.length / maxPoints);
      result = merged.filter((_, i) => i % step === 0 || i === merged.length - 1);
    }

    return { chartData: result, accountIds: ids };
  }, [data]);

  return (
    <div className="panel panel-full">
      <div className="panel-header">
        <div className="panel-title">📈 Equity History (24h)</div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {accountIds.length} account{accountIds.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="chart-container">
        {chartData.length === 0 ? (
          <div className="empty-state" style={{ padding: 60 }}>
            <div className="empty-emoji">📊</div>
            Collecting equity data... snapshots every 30s
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <XAxis
                dataKey="time"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15, 17, 21, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                labelStyle={{ color: '#94a3b8', marginBottom: 4 }}
                formatter={(value: number, name: string) => {
                  const label = name.startsWith('eq_') ? `Equity (${name.slice(3)})` : `Balance (${name.slice(4)})`;
                  return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, label];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
                formatter={(value: string) => {
                  if (value.startsWith('eq_')) return `Eq: ${value.slice(3)}`;
                  return `Bal: ${value.slice(4)}`;
                }}
              />
              {accountIds.map((id, idx) => (
                <Line
                  key={`eq_${id}`}
                  type="monotone"
                  dataKey={`eq_${id}`}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
              {accountIds.map((id, idx) => (
                <Line
                  key={`bal_${id}`}
                  type="monotone"
                  dataKey={`bal_${id}`}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls
                  opacity={0.5}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
