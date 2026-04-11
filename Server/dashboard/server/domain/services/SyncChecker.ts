/**
 * ═══════════════════════════════════════════════════════
 *  Domain Service: SyncChecker
 *  Compares master vs slave positions for sync monitoring
 * ═══════════════════════════════════════════════════════
 */

import type { IAccountStore } from '../ports/IAccountStore.js';

export interface MasterPositionData {
  accountId: string;
  count: number;
  symbols: string[];
  details: unknown[];
}

export interface SlaveSyncData {
  accountId: string;
  subscribedTo: string;
  masterPositions: number;
  slavePositions: number;
  synced: boolean;
  missing: number;
  missingSymbols: string[];
  slaveDetails: unknown[];
}

export interface SyncStatus {
  masters: Record<string, MasterPositionData>;
  slaves: SlaveSyncData[];
}

export class SyncChecker {
  constructor(private accounts: IAccountStore) {}

  check(): SyncStatus {
    const masterPositions: Record<string, MasterPositionData> = {};

    this.accounts.allMasters().forEach((m, id) => {
      const details = m.info.positionDetails || [];
      masterPositions[id] = {
        accountId: id,
        count: m.info.positions || details.length,
        symbols: details.map(p => p.symbol),
        details,
      };
    });

    const slaveSync: SlaveSyncData[] = [];
    const masterIds = Object.keys(masterPositions);

    this.accounts.allSlaves().forEach((s, id) => {
      const slaveDetails = s.info.positionDetails || [];
      const subscribedTo = s.subscribedTo || masterIds[0] || '';
      const masterData = masterPositions[subscribedTo] || { count: 0, symbols: [], details: [] };

      const masterCount = masterData.count;
      const slaveCount = s.info.positions || slaveDetails.length;

      const slaveSymbols = slaveDetails.map(p => p.symbol);
      const missingSymbols = masterData.symbols.filter(sym => !slaveSymbols.includes(sym));

      slaveSync.push({
        accountId: id,
        subscribedTo,
        masterPositions: masterCount,
        slavePositions: slaveCount,
        synced: masterCount === slaveCount,
        missing: masterCount - slaveCount,
        missingSymbols,
        slaveDetails,
      });
    });

    return { masters: masterPositions, slaves: slaveSync };
  }
}
