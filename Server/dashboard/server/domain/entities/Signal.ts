/**
 * ═══════════════════════════════════════════════════════
 *  Domain Entity: Signal
 *  Trade signal value object — immutable after creation
 * ═══════════════════════════════════════════════════════
 */

export interface SignalEntry {
  time: number;
  seq: number;
  masterID: string;
  type: string;       // OPEN_BUY, OPEN_SELL, CLOSE_BUY, CLOSE_SELL, MODIFY
  symbol: string;
  lots: number;
  price: number;
  fillPrice: number;
  ticket: number;
  fillTimeMs: number;
}

export interface RawSignalMessage {
  action: 'signal';
  mid?: string;
  id?: string;
  type?: string;
  sym?: string;
  lots?: number;
  price?: number;
  fp?: number;        // fill price
  ticket?: number;
}

/**
 * Create a SignalEntry from raw EA message
 */
export function createSignalEntry(raw: RawSignalMessage, masterID: string, seq: number): SignalEntry {
  return {
    time: Date.now(),
    seq,
    masterID,
    type: raw.type || 'unknown',
    symbol: raw.sym || '',
    lots: raw.lots || 0,
    price: raw.price || 0,
    fillPrice: raw.fp || raw.price || 0,
    ticket: raw.ticket || 0,
    fillTimeMs: 0,
  };
}

/**
 * Check if signal is a CLOSE type
 */
export function isCloseSignal(signal: SignalEntry): boolean {
  return signal.type.includes('CLOSE');
}
