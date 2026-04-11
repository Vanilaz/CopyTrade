// ═══ Formatting Utilities ═══

export function formatCurrency(val: number | undefined | null): string {
  if (val === undefined || val === null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

export function formatPnL(val: number | undefined | null): { text: string; className: string } {
  if (val === undefined || val === null || Math.abs(val) < 0.005) {
    return { text: '$0.00', className: 'pnl-zero' };
  }
  const sign = val > 0 ? '+$' : '-$';
  const abs = Math.abs(val);
  const text = `${sign}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const className = val > 0 ? 'pnl-positive' : 'pnl-negative';
  return { text, className };
}

export function timeAgo(ts: number | undefined): string {
  if (!ts) return '—';
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 0 || sec < 5) return 'just now';
  if (sec < 60) return sec + 's ago';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
  if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
  return Math.floor(sec / 86400) + 'd ago';
}

export function formatTime(ts: number | undefined): string {
  if (!ts) return '—';
  const d = new Date(typeof ts === 'number' ? ts : parseInt(String(ts)) * 1000);
  return d.toLocaleString('en-US', {
    hour12: false, month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }) || '—';
}

export function formatUptime(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h > 0 ? h + 'h ' : '') + (m > 0 || h > 0 ? m + 'm ' : '') + s + 's';
}

export function getPnLColor(val: number): string {
  if (val > 0) return 'var(--accent-success)';
  if (val < 0) return 'var(--accent-danger)';
  return 'var(--text-muted)';
}
