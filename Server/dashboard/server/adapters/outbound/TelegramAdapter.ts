/**
 * ═══════════════════════════════════════════════════════
 *  Outbound Adapter: TelegramAdapter
 *  Implements INotifier using Telegram Bot API
 * ═══════════════════════════════════════════════════════
 */

import https from 'node:https';
import type { INotifier } from '../../domain/ports/INotifier.js';

export class TelegramAdapter implements INotifier {
  constructor(
    private botToken: string,
    private chatId: string,
  ) {}

  sendMessage(text: string): void {
    if (!this.botToken || !this.chatId) return;

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const data = JSON.stringify({
      chat_id: this.chatId,
      text,
      parse_mode: 'HTML',
    });

    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    });
    req.on('error', () => {}); // Silently ignore Telegram errors
    req.write(data);
    req.end();
  }
}
