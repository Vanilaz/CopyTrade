/**
 * ═══════════════════════════════════════════════════════
 *  Infrastructure: Config
 *  Centralized configuration — env vars > config.json > defaults
 * ═══════════════════════════════════════════════════════
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Load config.json if exists ─────────────────────────
interface FileConfig {
  server?: {
    tcpPort?: number;
    httpPort?: number;
  };
}

let fileConfig: FileConfig = {};
try {
  const cfgPath = path.join(__dirname, '..', '..', '..', 'Config', 'config.json');
  if (fs.existsSync(cfgPath)) {
    fileConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    console.log('[CONFIG] Loaded config from Config/config.json');
  }
} catch (e: unknown) {
  console.log(`[CONFIG] Could not load config.json: ${(e as Error).message} — using defaults`);
}

// ─── Configuration ──────────────────────────────────────
export const Config = {
  tcpPort: parseInt(process.env.TCP_PORT || '') || fileConfig.server?.tcpPort || 5555,
  httpPort: parseInt(process.env.HTTP_PORT || '') || fileConfig.server?.httpPort || 8080,
  authToken: process.env.AUTH_TOKEN || '',
  dashboardPasscode: process.env.DASHBOARD_PASSCODE || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  heartbeatTimeout: 30000,
  httpHeartbeatTimeout: 60000,
  retentionDays: 7,
  brokerTimezone: process.env.BROKER_TIMEZONE || 'Europe/Athens',
  performanceSaveInterval: 5 * 60 * 1000,  // 5 minutes

  // Paths
  dataDir: path.join(__dirname, '..', '..', 'data'),
  distDir: path.join(__dirname, '..', '..', 'dist'),

  // Mode
  httpOnly: process.env.HTTP_ONLY === 'true' || process.env.VERCEL === '1',
} as const;

export type AppConfig = typeof Config;
