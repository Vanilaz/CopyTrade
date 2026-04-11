/**
 * ═══════════════════════════════════════════════════════
 *  Use Case: GetDashboardData
 *  Gather all dashboard-related data in one call
 * ═══════════════════════════════════════════════════════
 */

import type { IAccountStore } from '../domain/ports/IAccountStore.js';
import type { ISignalStore } from '../domain/ports/ISignalStore.js';
import type { PerformanceTracker } from '../domain/services/PerformanceTracker.js';
import type { EquityTracker } from '../domain/services/EquityTracker.js';
import type { SyncChecker } from '../domain/services/SyncChecker.js';
import type { RiskCalculator } from '../domain/services/RiskCalculator.js';

export class GetDashboardData {
  constructor(
    private accounts: IAccountStore,
    private signalStore: ISignalStore,
    private perfTracker: PerformanceTracker,
    private equityTracker: EquityTracker,
    private syncChecker: SyncChecker,
    private riskCalculator: RiskCalculator,
  ) {}

  getStatus() {
    const masterList: unknown[] = [];
    this.accounts.allMasters().forEach((m, id) => {
      const isHttp = m.transport === 'http';
      const connected = isHttp
        ? (Date.now() - m.lastHeartbeat < 60000)
        : (m.socketHandle != null);
      masterList.push({
        id, transport: m.transport, connected,
        lastHeartbeat: m.lastHeartbeat, info: m.info,
      });
    });

    const slaveList: unknown[] = [];
    this.accounts.allSlaves().forEach((s, id) => {
      const isHttp = s.transport === 'http';
      const connected = isHttp
        ? (Date.now() - s.lastHeartbeat < 60000)
        : (s.socketHandle != null);
      slaveList.push({
        id, subscribedTo: s.subscribedTo, transport: s.transport,
        connected, lastHeartbeat: s.lastHeartbeat, info: s.info,
      });
    });

    return {
      masters: masterList,
      slaves: slaveList,
      signalCount: this.signalStore.getSignals().length,
    };
  }

  getSync() {
    return this.syncChecker.check();
  }

  getRisk() {
    return this.riskCalculator.calculate();
  }

  getPerformance() {
    return this.perfTracker.getSummaries(this.accounts);
  }

  getEquityHistory() {
    return this.equityTracker.getHistory(this.accounts);
  }

  getSignals(limit = 100) {
    return this.signalStore.getSignals(limit);
  }

  getHistory(limit = 500) {
    return this.signalStore.getHistory(limit);
  }

  getPositions() {
    const positions: Record<string, { role: string; details: unknown[] }> = {};
    this.accounts.allMasters().forEach((m, id) => {
      positions[id] = { role: 'master', details: m.info.positionDetails || [] };
    });
    this.accounts.allSlaves().forEach((s, id) => {
      positions[id] = { role: 'slave', details: s.info.positionDetails || [] };
    });
    return positions;
  }
}
