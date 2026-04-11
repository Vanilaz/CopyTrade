/**
 * ═══════════════════════════════════════════════════════
 *  Infrastructure: Scheduler
 *  Periodic tasks — heartbeat check, auto-save, daily report
 * ═══════════════════════════════════════════════════════
 */

import type { IAccountStore } from '../domain/ports/IAccountStore.js';
import type { INotifier } from '../domain/ports/INotifier.js';
import type { IPersistence } from '../domain/ports/IPersistence.js';
import type { IBroadcaster } from '../domain/ports/IBroadcaster.js';
import type { PerformanceTracker } from '../domain/services/PerformanceTracker.js';
import type { ISignalStore } from '../domain/ports/ISignalStore.js';
import { getBrokerDate } from '../domain/services/PerformanceTracker.js';

interface SchedulerDeps {
  accounts: IAccountStore;
  perfTracker: PerformanceTracker;
  signalStore: ISignalStore;
  persistence: IPersistence;
  notifier: INotifier;
  broadcaster: IBroadcaster;
  getStatusFn: () => unknown;
  heartbeatTimeout: number;
  httpHeartbeatTimeout: number;
  saveInterval: number;
  brokerTimezone: string;
}

export class Scheduler {
  private timers: ReturnType<typeof setInterval>[] = [];

  constructor(private deps: SchedulerDeps) {}

  start(): void {
    // ─── Heartbeat checker (every 10s) ───
    this.timers.push(setInterval(() => this.checkHeartbeats(), 10000));

    // ─── Auto-save performance ───
    this.timers.push(setInterval(() => this.savePerformance(), this.deps.saveInterval));

    // ─── Daily report check (every 60s) ───
    this.timers.push(setInterval(() => this.checkDailyReport(), 60000));
  }

  stop(): void {
    this.timers.forEach(t => clearInterval(t));
    this.timers = [];
  }

  savePerformance(): void {
    this.deps.persistence.savePerformance(this.deps.perfTracker.exportAll());
  }

  saveHistory(): void {
    this.deps.persistence.saveHistory(this.deps.signalStore.getHistory());
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    const { accounts, heartbeatTimeout, httpHeartbeatTimeout, broadcaster } = this.deps;
    let changed = false;

    accounts.allMasters().forEach((m, id) => {
      const timeout = m.transport === 'http' ? httpHeartbeatTimeout : heartbeatTimeout;
      if (now - m.lastHeartbeat > timeout) {
        console.warn(`[Scheduler] Master "${id}" heartbeat timeout — removing`);
        const socket = m.socketHandle as any;
        if (socket?.destroy) socket.destroy();
        accounts.deleteMaster(id);
        changed = true;
      }
    });

    accounts.allSlaves().forEach((s, id) => {
      const timeout = s.transport === 'http' ? httpHeartbeatTimeout : heartbeatTimeout;
      if (now - s.lastHeartbeat > timeout) {
        console.warn(`[Scheduler] Slave "${id}" heartbeat timeout — removing`);
        const socket = s.socketHandle as any;
        if (socket?.destroy) socket.destroy();
        accounts.deleteSlave(id);
        changed = true;
      }
    });

    if (changed) {
      broadcaster.broadcast('status', this.deps.getStatusFn());
    }
  }

  private checkDailyReport(): void {
    const now = getBrokerDate(this.deps.brokerTimezone);
    if (now.getHours() === 23 && now.getMinutes() === 59) {
      const report = this.deps.perfTracker.getDailyReport(this.deps.accounts);
      if (report.lines.length === 0) return; // Don't send empty reports
      const msg = `📊 <b>CopyTrade Daily Summary</b>
📅 Date: ${now.toLocaleDateString('en-GB')}
━━━━━━━━━━━━━━━━━━━━
💰 Total AUM: $${report.totalAum.toFixed(2)}
📈 Total P&L: $${report.totalPnl.toFixed(2)}
🎯 Win Rate: ${report.winRate}%
⚡ Total Trades: ${report.totalTradesCount}
━━━━━━━━━━━━━━━━━━━━
${report.lines.join('\n')}
━━━━━━━━━━━━━━━━━━━━
⚠️ Alert: All systems operational.`;

      this.deps.notifier.sendMessage(msg);
    }
  }
}
