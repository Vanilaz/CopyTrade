/**
 * ═══════════════════════════════════════════════════════
 *  Port: ISignalStore
 *  Interface for signal log and trade history storage
 * ═══════════════════════════════════════════════════════
 */

import type { SignalEntry } from '../entities/Signal.js';

export interface ISignalStore {
  // ─── Signal log (recent signals) ───
  addSignal(signal: SignalEntry): void;
  getSignals(limit?: number): SignalEntry[];

  // ─── Trade history (closed trades) ───
  addToHistory(signal: SignalEntry): void;
  getHistory(limit?: number): SignalEntry[];
  setHistory(history: SignalEntry[]): void;

  // ─── Sequence ───
  nextSeq(): number;
  currentSeq(): number;
}
