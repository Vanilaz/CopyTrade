/**
 * ═══════════════════════════════════════════════════════
 *  Use Case: ProcessSignal
 *  Log signal, route to slaves, broadcast to dashboard
 * ═══════════════════════════════════════════════════════
 */

import type { RawSignalMessage } from '../domain/entities/Signal.js';
import { createSignalEntry, isCloseSignal } from '../domain/entities/Signal.js';
import type { ISignalStore } from '../domain/ports/ISignalStore.js';
import type { IBroadcaster } from '../domain/ports/IBroadcaster.js';
import type { SignalRouter } from '../domain/services/SignalRouter.js';

export interface SignalSender {
  sendToSlave(slaveId: string, socketHandle: unknown, message: unknown): void;
  queueForHttpSlave(slaveId: string, message: unknown): void;
}

export class ProcessSignal {
  private historySaveTimer: ReturnType<typeof setTimeout> | null = null;
  private onHistorySave?: () => void;

  constructor(
    private signalStore: ISignalStore,
    private router: SignalRouter,
    private broadcaster: IBroadcaster,
    private sender: SignalSender,
  ) {}

  setHistorySaveCallback(fn: () => void): void {
    this.onHistorySave = fn;
  }

  execute(masterID: string, raw: RawSignalMessage): { routed: number; seq: number } {
    // 1. Create signal entry
    const seq = this.signalStore.nextSeq();
    const signal = createSignalEntry(raw, masterID, seq);

    // 2. Log signal
    this.signalStore.addSignal(signal);

    // 3. Add to history if close signal
    if (isCloseSignal(signal)) {
      this.signalStore.addToHistory(signal);
      this.scheduleHistorySave();
    }

    // 4. Route to subscribed slaves
    const targets = this.router.findTargets(masterID);
    let routedCount = 0;

    for (const { slaveId, slave } of targets) {
      if (slave.transport === 'http') {
        this.sender.queueForHttpSlave(slaveId, raw);
        routedCount++;
      } else if (slave.socketHandle) {
        this.sender.sendToSlave(slaveId, slave.socketHandle, raw);
        routedCount++;
      }
    }

    // 5. Broadcast to dashboard
    this.broadcaster.broadcast('signal', signal);
    if (isCloseSignal(signal)) {
      this.broadcaster.broadcast('tradeHistory', this.signalStore.getHistory(100));
    }

    return { routed: routedCount, seq: signal.seq };
  }

  private scheduleHistorySave(): void {
    if (this.historySaveTimer) return;
    this.historySaveTimer = setTimeout(() => {
      this.historySaveTimer = null;
      this.onHistorySave?.();
    }, 5000);
  }
}
