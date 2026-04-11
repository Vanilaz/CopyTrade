import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import type { EquityPoint } from '../../types/api';

interface EquityChartProps {
  history: EquityPoint[];
}

export function EquityChart({ history }: EquityChartProps) {
  // Group history by timestamp for multi-line chart
  const groupedData = history.reduce((acc: any[], curr) => {
    const time = new Date(curr.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let point = acc.find(p => p.time === time);
    if (!point) {
      point = { time };
      acc.push(point);
    }
    point[curr.accountId] = curr.equity;
    return acc;
  }, []);

  const accountIds = Array.from(new Set(history.map(h => h.accountId)));
  const colors = ['#3b82f6', '#c084fc', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="w-full h-full min-h-[300px] flex flex-col pt-4 relative">
      {/* TradingView-style Live Badge */}
      <div className="absolute top-2 left-6 z-10 chart-live-badge group">
        <div className="chart-live-dot">
          <div className="live-pulse-ring text-accent-danger" />
        </div>
        <span className="text-[9px] font-black text-white/80 tracking-[0.2em] uppercase">LIVE STREAM</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={groupedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {accountIds.map((id, index) => (
              <linearGradient key={id} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.15}/>
                <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
          <XAxis 
            dataKey="time" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 700 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#4b5563', fontSize: 10, fontWeight: 700 }}
            domain={['auto', 'auto']}
            tickFormatter={(value) => `$${(value / 1000).toFixed(2)}k`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(13, 17, 23, 0.9)', 
              borderRadius: '16px', 
              border: '1px solid rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              padding: '12px 16px'
            }}
            itemStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}
            labelStyle={{ color: '#9ca3af', fontSize: '10px', marginBottom: '8px', fontWeight: 900, textTransform: 'uppercase' }}
            cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
          />
          <Legend 
            verticalAlign="top" 
            align="right" 
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{value}</span>}
          />
          {accountIds.map((id, index) => (
            <Area
              key={id}
              type="monotone"
              dataKey={id}
              stroke={colors[index % colors.length]}
              strokeWidth={2}
              fillOpacity={1}
              fill={`url(#gradient-${index})`}
              animationDuration={300}
              isAnimationActive={true}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
