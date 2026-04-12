/**
 * ═══════════════════════════════════════════════════════
 *  Outbound Adapter: InMemorySignalStore
 *  Implements ISignalStore using in-memory arrays
 * ═══════════════════════════════════════════════════════
 */

import type { SignalEntry } from '../../domain/entities/Signal.js';
import type { ISignalStore } from '../../domain/ports/ISignalStore.js';

const MAX_SIGNAL_LOG = 1000;
const MAX_HISTORY = 5000;

export class InMemorySignalStore implements ISignalStore {
  private signals: SignalEntry[] = [];
  private history: SignalEntry[] = [];
  private seq = 0;

  addSignal(signal: SignalEntry): void {
    this.signals.push(signal);
    if (this.signals.length > MAX_SIGNAL_LOG) this.signals.shift();
  }

  getSignals(limit?: number): SignalEntry[] {
    return limit ? this.signals.slice(-limit) : this.signals;
  }

  addToHistory(signal: SignalEntry): void {
    this.history.unshift(signal);
    if (this.history.length > MAX_HISTORY) this.history.pop();
  }

  getHistory(limit?: number): SignalEntry[] {
    return limit ? this.history.slice(0, limit) : this.history;
  }

  setHistory(history: SignalEntry[]): void {
    this.history = history;
  }

  clearAccountHistory(accountId: string): void {
    const initial = this.signals.length + this.history.length;
    this.signals = this.signals.filter(s => s.masterID !== accountId);
    this.history = this.history.filter(s => s.masterID !== accountId);
    const deleted = initial - (this.signals.length + this.history.length);
    if (deleted > 0) {
      console.log(`[InMemorySignalStore] Cleared ${deleted} signals for account: ${accountId}`);
    }
  }

  nextSeq(): number { return ++this.seq; }
  currentSeq(): number { return this.seq; }
}
