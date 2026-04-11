/**
 * ═══════════════════════════════════════════════════════
 *  Port: IPersistence
 *  Interface for saving/loading data to durable storage
 * ═══════════════════════════════════════════════════════
 */

import type { AccountPerformance } from '../entities/Performance.js';
import type { SignalEntry } from '../entities/Signal.js';

export interface IPersistence {
  savePerformance(data: Record<string, AccountPerformance>): void;
  loadPerformance(): Record<string, AccountPerformance>;
  saveHistory(history: SignalEntry[]): void;
  loadHistory(): SignalEntry[];
}
