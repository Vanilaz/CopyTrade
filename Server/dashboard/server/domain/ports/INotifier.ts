/**
 * ═══════════════════════════════════════════════════════
 *  Port: INotifier
 *  Interface for sending external notifications
 * ═══════════════════════════════════════════════════════
 */

export interface INotifier {
  sendMessage(text: string): void;
}
