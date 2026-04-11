/**
 * ═══════════════════════════════════════════════════════
 *  Outbound Adapter: FileStorageAdapter
 *  Implements IPersistence using JSON files
 * ═══════════════════════════════════════════════════════
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AccountPerformance } from '../../domain/entities/Performance.js';
import type { SignalEntry } from '../../domain/entities/Signal.js';
import type { IPersistence } from '../../domain/ports/IPersistence.js';

export class FileStorageAdapter implements IPersistence {
  private performanceFile: string;
  private historyFile: string;

  constructor(dataDir: string) {
    this.performanceFile = path.join(dataDir, 'performance.json');
    this.historyFile = path.join(dataDir, 'history.json');
  }

  savePerformance(data: Record<string, AccountPerformance>): void {
    try {
      const dir = path.dirname(this.performanceFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.performanceFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (e: unknown) {
      console.error(`[FileStorage] Failed to save performance: ${(e as Error).message}`);
    }
  }

  loadPerformance(): Record<string, AccountPerformance> {
    try {
      if (fs.existsSync(this.performanceFile)) {
        const raw = fs.readFileSync(this.performanceFile, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e: unknown) {
      console.error(`[FileStorage] Failed to load performance: ${(e as Error).message}`);
    }
    return {};
  }

  saveHistory(history: SignalEntry[]): void {
    try {
      const dir = path.dirname(this.historyFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.historyFile, JSON.stringify(history), 'utf8');
    } catch (e: unknown) {
      console.error(`[FileStorage] Failed to save history: ${(e as Error).message}`);
    }
  }

  loadHistory(): SignalEntry[] {
    try {
      if (fs.existsSync(this.historyFile)) {
        const raw = fs.readFileSync(this.historyFile, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) return data;
      }
    } catch (e: unknown) {
      console.error(`[FileStorage] Failed to load history: ${(e as Error).message}`);
    }
    return [];
  }
}
