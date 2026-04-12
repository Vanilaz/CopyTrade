/**
 * ═══════════════════════════════════════════════════════
 *  CopyTrade Relay Server v3.0
 *  Clean Architecture — Composition Root
 *
 *  This is the ONLY place where all dependencies
 *  are wired together (Dependency Injection)
 * ═══════════════════════════════════════════════════════
 */

import { Config } from './infrastructure/config.js';

// ─── Domain Services ─────────────────────────────────────
import { PerformanceTracker } from './domain/services/PerformanceTracker.js';
import { SignalRouter } from './domain/services/SignalRouter.js';
import { SyncChecker } from './domain/services/SyncChecker.js';
import { RiskCalculator } from './domain/services/RiskCalculator.js';
import { EquityTracker } from './domain/services/EquityTracker.js';

// ─── Outbound Adapters ───────────────────────────────────
import { InMemoryAccountStore } from './adapters/outbound/InMemoryAccountStore.js';
import { InMemorySignalStore } from './adapters/outbound/InMemorySignalStore.js';
import { FileStorageAdapter } from './adapters/outbound/FileStorageAdapter.js';
import { TelegramAdapter } from './adapters/outbound/TelegramAdapter.js';
import { DashboardBroadcaster } from './adapters/outbound/DashboardBroadcaster.js';

// ─── Use Cases ───────────────────────────────────────────
import { AuthenticateEA } from './application/AuthenticateEA.js';
import { ProcessHeartbeat } from './application/ProcessHeartbeat.js';
import { ProcessSignal } from './application/ProcessSignal.js';
import { GetDashboardData } from './application/GetDashboardData.js';
import { ResetPerformance } from './application/ResetPerformance.js';

// ─── Inbound Adapters ────────────────────────────────────
import { TcpAdapter } from './adapters/inbound/TcpAdapter.js';
import { HttpAdapter } from './adapters/inbound/HttpAdapter.js';
import { WebSocketAdapter } from './adapters/inbound/WebSocketAdapter.js';

// ─── Infrastructure ──────────────────────────────────────
import { Scheduler } from './infrastructure/scheduler.js';

// ═══════════════════════════════════════════════════════
//  1. Outbound Adapters (implementations of ports)
// ═══════════════════════════════════════════════════════
const accounts = new InMemoryAccountStore();
const signalStore = new InMemorySignalStore();
const persistence = new FileStorageAdapter(Config.dataDir);
const notifier = new TelegramAdapter(Config.telegramBotToken, Config.telegramChatId);
const broadcaster = new DashboardBroadcaster();

// ═══════════════════════════════════════════════════════
//  2. Domain Services (pure business logic)
// ═══════════════════════════════════════════════════════
const perfTracker = new PerformanceTracker(Config.brokerTimezone);
const signalRouter = new SignalRouter(accounts);
const syncChecker = new SyncChecker(accounts);
const riskCalculator = new RiskCalculator(accounts);
const equityTracker = new EquityTracker();

// ═══════════════════════════════════════════════════════
//  3. Use Cases (application orchestration)
// ═══════════════════════════════════════════════════════
const dashboard = new GetDashboardData(accounts, signalStore, perfTracker, equityTracker, syncChecker, riskCalculator);

const authenticateEA = new AuthenticateEA(Config.authToken, accounts, perfTracker, broadcaster);
const processHeartbeat = new ProcessHeartbeat(
  accounts, perfTracker, equityTracker, broadcaster, 
  () => dashboard.getStatus(),
  () => dashboard.getSync(),
  () => dashboard.getRisk()
);
const processSignal = new ProcessSignal(signalStore, signalRouter, broadcaster, null as any, perfTracker); // sender set below
const resetPerf = new ResetPerformance(perfTracker, accounts, broadcaster, persistence);

// ═══════════════════════════════════════════════════════
//  4. Inbound Adapters (driving adapters)
// ═══════════════════════════════════════════════════════
const tcpAdapter = new TcpAdapter(authenticateEA, processHeartbeat, processSignal, dashboard, accounts, broadcaster);
const httpAdapter = new HttpAdapter(
  authenticateEA, processHeartbeat, processSignal, dashboard, resetPerf,
  accounts, perfTracker, broadcaster, Config, Config.distDir,
);
const wsAdapter = new WebSocketAdapter(dashboard, broadcaster, Config.dashboardPasscode);

// Wire signal sender (TCP adapter implements SignalSender)
(processSignal as any).sender = tcpAdapter;

// Wire history save callback
processSignal.setHistorySaveCallback(() => {
  persistence.saveHistory(signalStore.getHistory());
});

// ═══════════════════════════════════════════════════════
//  5. Scheduler (periodic tasks)
// ═══════════════════════════════════════════════════════
const scheduler = new Scheduler({
  accounts, perfTracker, signalStore, equityTracker, persistence, notifier, broadcaster,
  getStatusFn: () => dashboard.getStatus(),
  heartbeatTimeout: Config.heartbeatTimeout,
  httpHeartbeatTimeout: Config.httpHeartbeatTimeout,
  retentionDays: Config.retentionDays,
  saveInterval: Config.performanceSaveInterval,
  brokerTimezone: Config.brokerTimezone,
});

// ═══════════════════════════════════════════════════════
//  6. Load persisted data & Start
// ═══════════════════════════════════════════════════════
const perfData = persistence.loadPerformance();
perfTracker.importAll(perfData);
console.log(`✅ Loaded performance data for ${perfTracker.size} accounts`);

const historyData = persistence.loadHistory();
signalStore.setHistory(historyData);
console.log(`✅ Loaded trade history with ${historyData.length} records`);

// ─── Start TCP server ────────────────────────────────────
if (!Config.httpOnly) {
  console.log('');
  console.log('  ═══════════════════════════════════════════════');
  console.log('  ║  CopyTrade Relay Server v3.0                ║');
  console.log('  ║  Clean Architecture — TypeScript             ║');
  console.log('  ═══════════════════════════════════════════════');
  tcpAdapter.listen(Config.tcpPort);
} else {
  console.log('☁️ Running in HTTP-ONLY mode (no TCP server)');
}

// ─── Start HTTP server ───────────────────────────────────
const PORT = parseInt(process.env.PORT || '') || Config.httpPort;
httpAdapter.listen(PORT);

// ─── Attach WebSocket to HTTP ────────────────────────────
wsAdapter.attach(httpAdapter.getServer());

// ─── Start scheduler ─────────────────────────────────────
scheduler.start();

console.log('  ═══════════════════════════════════════════════');
console.log(`  ║  Dashboard : http://localhost:${PORT}`);
console.log(`  ║  Health    : http://localhost:${PORT}/health`);
console.log(`  ║  Auth Token: ${Config.authToken ? Config.authToken.substring(0, 4) + '****' : '(none)'}`);
console.log('  ═══════════════════════════════════════════════');
console.log('');

// ─── Graceful shutdown ───────────────────────────────────
process.on('SIGINT', () => {
  console.log('\n⏹️ Shutting down...');
  scheduler.stop();
  scheduler.savePerformance();
  scheduler.saveHistory();
  if (!Config.httpOnly) tcpAdapter.close();
  accounts.allMasters().forEach(m => { const s = m.socketHandle as any; if (s?.destroy) s.destroy(); });
  accounts.allSlaves().forEach(s => { const sk = s.socketHandle as any; if (sk?.destroy) sk.destroy(); });
  process.exit(0);
});
