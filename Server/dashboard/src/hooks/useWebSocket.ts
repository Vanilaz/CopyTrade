import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  StatusData, SignalEntry, AccountPerformance,
  SyncStatus, RiskMetric, EquityHistoryData, PositionsData,
} from '../types/api';

interface DashboardState {
  connected: boolean;
  status: StatusData | null;
  signals: SignalEntry[];
  tradeHistory: SignalEntry[];
  performance: AccountPerformance[];
  sync: SyncStatus | null;
  risk: RiskMetric[];
  equityHistory: EquityHistoryData | null;
  positions: PositionsData | null;
}

export function useWebSocket(passcode: string) {
  const [state, setState] = useState<DashboardState>({
    connected: false,
    status: null,
    signals: [],
    tradeHistory: [],
    performance: [],
    sync: null,
    risk: [],
    equityHistory: null,
    positions: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [authError, setAuthError] = useState(false);

  const connect = useCallback(() => {
    if (!passcode) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${window.location.host}?passcode=${passcode}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setState(s => ({ ...s, connected: true }));
      setAuthError(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setState(s => {
          switch (msg.type) {
            case 'status':
              return { ...s, status: msg.data };
            case 'signal':
              return { ...s, signals: [...s.signals.slice(-199), msg.data] };
            case 'signalHistory':
              return { ...s, signals: msg.data || [] };
            case 'tradeHistory':
              return { ...s, tradeHistory: msg.data || [] };
            case 'performance':
              return { ...s, performance: msg.data || [] };
            case 'sync':
              return { ...s, sync: msg.data };
            case 'risk':
              return { ...s, risk: msg.data || [] };
            case 'equityHistory':
              return { ...s, equityHistory: msg.data };
            default:
              return s;
          }
        });
      } catch { /* ignore parse errors */ }
    };

    ws.onclose = (e) => {
      setState(s => ({ ...s, connected: false }));
      wsRef.current = null;

      if (e.code === 4001) {
        setAuthError(true);
        localStorage.removeItem('copytrade_passcode');
      } else {
        reconnectRef.current = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => ws.close();
  }, [passcode]);

  // Periodic fetch for sync/risk/equity/positions (not sent via WS broadcast)
  useEffect(() => {
    if (!passcode || !state.connected) return;

    const fetchExtra = async () => {
      try {
        const headers: Record<string, string> = { 'X-Passcode': passcode };
        const [syncRes, riskRes, eqRes, posRes] = await Promise.all([
          fetch(`/api/sync?passcode=${passcode}`, { headers }),
          fetch(`/api/risk?passcode=${passcode}`, { headers }),
          fetch(`/api/equity-history?passcode=${passcode}`, { headers }),
          fetch(`/api/positions?passcode=${passcode}`, { headers }),
        ]);
        const [sync, risk, eq, pos] = await Promise.all([
          syncRes.json(), riskRes.json(), eqRes.json(), posRes.json(),
        ]);
        setState(s => ({
          ...s,
          sync: (sync && !sync.error) ? sync as SyncStatus : s.sync,
          risk: Array.isArray(risk) ? risk as RiskMetric[] : s.risk,
          equityHistory: (eq && !eq.error) ? eq as EquityHistoryData : s.equityHistory,
          positions: (pos && !pos.error) ? pos as PositionsData : s.positions,
        }));
      } catch { /* silent */ }
    };

    fetchExtra();
    const interval = setInterval(fetchExtra, 5000);
    return () => clearInterval(interval);
  }, [passcode, state.connected]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { ...state, authError };
}
