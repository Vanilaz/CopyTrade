/**
 * ═══════════════════════════════════════════════════════
 *  Port: IBroadcaster
 *  Interface for real-time dashboard updates
 * ═══════════════════════════════════════════════════════
 */

export interface IBroadcaster {
  broadcast(type: string, data: unknown): void;
}
