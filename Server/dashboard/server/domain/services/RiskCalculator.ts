/**
 * ═══════════════════════════════════════════════════════
 *  Domain Service: RiskCalculator
 *  Exposure, margin usage, per-symbol risk analysis
 * ═══════════════════════════════════════════════════════
 */

import type { IAccountStore } from '../ports/IAccountStore.js';
import type { BaseAccount } from '../entities/Account.js';

export interface SymbolExposure {
  lots: number;
  pnl: number;
  count: number;
}

export interface AccountRisk {
  accountId: string;
  role: 'master' | 'slave';
  balance: number;
  equity: number;
  marginUsed: number;
  freeMargin: number;
  marginLevel: number;
  marginUsagePct: string;
  positions: number;
  exposure: Record<string, SymbolExposure>;
  floatingPnL: number;
}

export class RiskCalculator {
  constructor(private accounts: IAccountStore) {}

  calculate(): AccountRisk[] {
    const risks: AccountRisk[] = [];
    const allAccounts = new Map<string, BaseAccount>();
    this.accounts.allMasters().forEach((v, k) => allAccounts.set(k, v));
    this.accounts.allSlaves().forEach((v, k) => allAccounts.set(k, v));

    allAccounts.forEach((acct, id) => {
      const positions = acct.info.positionDetails || [];
      const exposure: Record<string, SymbolExposure> = {};

      positions.forEach(p => {
        const sym = p.symbol || 'UNKNOWN';
        if (!exposure[sym]) exposure[sym] = { lots: 0, pnl: 0, count: 0 };
        exposure[sym].lots += p.lots || 0;
        exposure[sym].pnl += p.pnl || 0;
        exposure[sym].count++;
      });

      risks.push({
        accountId: id,
        role: this.accounts.getMaster(id) ? 'master' : 'slave',
        balance: acct.info.balance || 0,
        equity: acct.info.equity || 0,
        marginUsed: acct.info.marginUsed || 0,
        freeMargin: acct.info.freeMargin || 0,
        marginLevel: acct.info.marginLevel || 0,
        marginUsagePct: (acct.info.balance > 0 && acct.info.marginUsed > 0)
          ? ((acct.info.marginUsed / acct.info.balance) * 100).toFixed(1) : '0.0',
        positions: acct.info.positions || 0,
        exposure,
        floatingPnL: acct.info.floatingPnL || 0,
      });
    });

    return risks;
  }
}
