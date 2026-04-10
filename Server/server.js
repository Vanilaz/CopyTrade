/**
 * ═══════════════════════════════════════════════════════
 *  CopyTrade Relay Server v1.1
 *  TCP Hub สำหรับ Master/Slave + WebSocket Dashboard
 *  + Per-Account Performance Tracking
 * ═══════════════════════════════════════════════════════
 */

const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Load config.json if exists ─────────────────────────
let fileConfig = {};
try {
  const cfgPath = path.join(__dirname, '..', 'Config', 'config.json');
  if (fs.existsSync(cfgPath)) {
    fileConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    console.log('[CONFIG] Loaded config from Config/config.json');
  }
} catch (e) {
  console.log(`[CONFIG] Could not load config.json: ${e.message} — using defaults`);
}

// ─── Configuration (priority: env vars > config.json > defaults) ───
const CONFIG = {
  tcpPort: parseInt(process.env.TCP_PORT) || (fileConfig.server && fileConfig.server.tcpPort) || 5555,
  httpPort: parseInt(process.env.HTTP_PORT) || (fileConfig.server && fileConfig.server.httpPort) || 8080,
  authToken: process.env.AUTH_TOKEN || '',
  dashboardPasscode: process.env.DASHBOARD_PASSCODE || '',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  heartbeatTimeout: 30000, // 30s no heartbeat = disconnect
  maxSignalLog: 500,
  maxHistoryLog: 1000,
  brokerTimezone: process.env.BROKER_TIMEZONE || 'Europe/Athens', // MT5 / Broker time (EET/EEST)
  performanceSaveInterval: 5 * 60 * 1000, // Save every 5 minutes
  performanceFile: path.join(__dirname, 'data', 'performance.json'),
  historyFile: path.join(__dirname, 'data', 'history.json'),
};

// ─── State ───────────────────────────────────────────────
const masters = new Map();      // id -> { socket, lastHeartbeat, info }
const slaves = new Map();       // id -> { socket, lastHeartbeat, subscribedTo, info }
const signalLog = [];           // Recent signals for dashboard
const tradeHistory = [];        // Closed trades collection
const connectionLog = [];       // Connection events
let wsClients = [];             // WebSocket dashboard clients

// ─── Performance Tracking ────────────────────────────────
// Per-account performance stats
const accountPerf = new Map();  // accountId -> AccountPerformance

function getBrokerDate(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CONFIG.brokerTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const p = {};
  for(let x of parts) p[x.type] = x.value;
  const h = p.hour === '24' ? '00' : p.hour;
  return new Date(`${p.year}-${p.month}-${p.day}T${h}:${p.minute}:${p.second}`);
}

function getDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function getWeekKey(d) {
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
function getMonthKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

function getOrCreatePerf(accountId, role) {
  if (!accountPerf.has(accountId)) {
    accountPerf.set(accountId, {
      accountId,
      role: role || 'unknown',
      // Balance snapshots for period P&L
      dayStartBalance: 0,
      dayStartNetBalance: 0,
      dayStartKey: '',
      weekStartBalance: 0,
      weekStartNetBalance: 0,
      weekStartKey: '',
      monthStartBalance: 0,
      monthStartNetBalance: 0,
      monthStartKey: '',
      // Current metrics
      currentBalance: 0,
      currentEquity: 0,
      floatingPnL: 0,
      marginLevel: 0,
      positions: 0,
      // Peak tracking for drawdown
      peakEquity: 0,
      maxDrawdown: 0,     // absolute $
      maxDrawdownPct: 0,   // percentage
      // Trade counters
      totalTrades: 0,
      winTrades: 0,
      lossTrades: 0,
      // Balance tracking for win/loss detection
      lastBalanceBeforeChange: 0,
      // Timestamps
      firstSeen: Date.now(),
      lastUpdate: Date.now(),
    });
  }
  return accountPerf.get(accountId);
}

function updateAccountPerformance(accountId, role, heartbeatData) {
  const perf = getOrCreatePerf(accountId, role);
  // Compare using broker time
  const now = getBrokerDate();
  const todayKey = getDateKey(now);
  const weekKey = getWeekKey(now);
  const monthKey = getMonthKey(now);

  const newBalance = heartbeatData.balance || 0;
  const newEquity = heartbeatData.equity || 0;
  const newCumDW = heartbeatData.cumulativeDW || 0;

  // Track purely trading-derived balance for accurate diff/profit
  const currentNetBalance = newBalance - newCumDW;

  if (perf.lastNetBalance === undefined) {
    perf.lastNetBalance = currentNetBalance;
  }

  // ─── Detect closed trade from balance change ───
  if (perf.currentBalance > 0 && currentNetBalance !== perf.lastNetBalance) {
    const diff = currentNetBalance - perf.lastNetBalance;
    // Only count if the change is significant (> $0.01) and not just floating
    if (Math.abs(diff) > 0.01) {
      perf.totalTrades++;
      if (diff > 0) perf.winTrades++;
      else perf.lossTrades++;
    }
  }

  // ─── Update current metrics ───
  perf.lastNetBalance = currentNetBalance;
  perf.currentBalance = newBalance;
  perf.currentEquity = newEquity;
  perf.floatingPnL = heartbeatData.floatingPnL || 0;
  perf.marginLevel = heartbeatData.marginLevel || 0;
  perf.positions = heartbeatData.positions || 0;
  perf.lastUpdate = Date.now();

  // ─── Period start balance snapshots ───
  if (perf.dayStartKey !== todayKey) {
    perf.dayStartBalance = newBalance;
    perf.dayStartNetBalance = currentNetBalance;
    perf.dayStartKey = todayKey;
  }
  if (perf.weekStartKey !== weekKey) {
    perf.weekStartBalance = newBalance;
    perf.weekStartNetBalance = currentNetBalance;
    perf.weekStartKey = weekKey;
  }
  if (perf.monthStartKey !== monthKey) {
    perf.monthStartBalance = newBalance;
    perf.monthStartNetBalance = currentNetBalance;
    perf.monthStartKey = monthKey;
  }

  // ─── Adjust Peak Equity for Deposits/Withdrawals ───
  if (perf.lastCumDW === undefined) {
    perf.lastCumDW = newCumDW;
  }
  
  // If a deposit or withdrawal occurred, shift the peak equity by the exact amount 
  // so we don't trigger an artificial massive drawdown
  if (newCumDW !== perf.lastCumDW) {
    const dwDiff = newCumDW - perf.lastCumDW; 
    perf.peakEquity += dwDiff;
    if (perf.peakEquity < 0) perf.peakEquity = newEquity > 0 ? newEquity : 0;
    perf.lastCumDW = newCumDW;
  }

  // ─── Peak equity & Drawdown ───
  if (newEquity > perf.peakEquity) {
    perf.peakEquity = newEquity;
  }
  
  if (perf.peakEquity > 0) {
    const dd = perf.peakEquity - newEquity;
    const ddPct = (dd / perf.peakEquity) * 100;
    
    // Only count huge positive DDs if they actually exist, filter out noise
    if (dd > 0 && dd > perf.maxDrawdown) perf.maxDrawdown = dd;
    if (ddPct > 0 && ddPct > perf.maxDrawdownPct) perf.maxDrawdownPct = ddPct;
  }

  return perf;
}

// Reset performance stats for one or all accounts (in-memory + disk)
function resetPerformanceStats(accountId) {
  const resetOne = (perf) => {
    const bal = perf.currentBalance || 0;
    const eq = perf.currentEquity || bal;
    perf.peakEquity = eq;
    perf.maxDrawdown = 0;
    perf.maxDrawdownPct = 0;
    perf.totalTrades = 0;
    perf.winTrades = 0;
    perf.lossTrades = 0;
    perf.dayStartBalance = bal;
    perf.dayStartNetBalance = perf.lastNetBalance || bal;
    perf.dayStartKey = getDateKey(getBrokerDate());
    perf.weekStartBalance = bal;
    perf.weekStartNetBalance = perf.lastNetBalance || bal;
    perf.weekStartKey = getWeekKey(getBrokerDate());
    perf.monthStartBalance = bal;
    perf.monthStartNetBalance = perf.lastNetBalance || bal;
    perf.monthStartKey = getMonthKey(getBrokerDate());
    perf.lastCumDW = undefined; // re-init on next heartbeat
  };

  if (accountId) {
    const perf = accountPerf.get(accountId);
    if (perf) { resetOne(perf); log('INFO', `Reset performance for account ${accountId}`); }
  } else {
    accountPerf.forEach((perf) => resetOne(perf));
    log('INFO', `Reset performance for ALL ${accountPerf.size} accounts`);
  }
  savePerformance();
}

function getPerformanceData() {
  const result = [];
  accountPerf.forEach((perf, id) => {
    // Hide disconnected accounts from the dashboard
    if (!masters.has(id) && !slaves.has(id)) return;

    // Safe PnL calculation — fallback to 0 if net balance fields are missing
    const netBal = perf.lastNetBalance !== undefined ? perf.lastNetBalance : perf.currentBalance;
    const dayStartNet = perf.dayStartNetBalance !== undefined ? perf.dayStartNetBalance : perf.dayStartBalance;
    const weekStartNet = perf.weekStartNetBalance !== undefined ? perf.weekStartNetBalance : perf.weekStartBalance;
    const monthStartNet = perf.monthStartNetBalance !== undefined ? perf.monthStartNetBalance : perf.monthStartBalance;

    const todayPnL = perf.dayStartBalance > 0 ? (netBal - dayStartNet) + perf.floatingPnL : perf.floatingPnL;
    const weekPnL = perf.weekStartBalance > 0 ? (netBal - weekStartNet) + perf.floatingPnL : perf.floatingPnL;
    const monthPnL = perf.monthStartBalance > 0 ? (netBal - monthStartNet) + perf.floatingPnL : perf.floatingPnL;
    const winRate = perf.totalTrades > 0 ? ((perf.winTrades / perf.totalTrades) * 100).toFixed(1) : '—';
    const currentDD = perf.peakEquity > 0 ? ((perf.peakEquity - perf.currentEquity) / perf.peakEquity * 100) : 0;

    result.push({
      accountId: id,
      role: perf.role,
      balance: perf.currentBalance,
      equity: perf.currentEquity,
      todayPnL,
      weekPnL,
      monthPnL,
      floating: perf.floatingPnL,
      totalTrades: perf.totalTrades,
      winTrades: perf.winTrades,
      lossTrades: perf.lossTrades,
      winRate,
      maxDrawdown: perf.maxDrawdown,
      maxDrawdownPct: perf.maxDrawdownPct.toFixed(2),
      currentDD: currentDD.toFixed(2),
      positions: perf.positions,
      marginLevel: perf.marginLevel,
      lastUpdate: perf.lastUpdate,
    });
  });
  return result;
}


// ─── Equity History (for chart) ──────────────────────────
const equityHistory = new Map(); // accountId -> [{ts, equity, balance}]
const EQUITY_SNAPSHOT_INTERVAL = 30000; // 30s between snapshots
const MAX_EQUITY_HISTORY = 2880; // ~24 hours at 30s intervals
const lastEquitySnapshot = new Map();

function snapshotEquityHistory(accountId, equity, balance) {
  const now = Date.now();
  const lastTs = lastEquitySnapshot.get(accountId) || 0;
  if (now - lastTs < EQUITY_SNAPSHOT_INTERVAL) return;

  if (!equityHistory.has(accountId)) equityHistory.set(accountId, []);
  const hist = equityHistory.get(accountId);
  hist.push({ ts: now, equity: equity || 0, balance: balance || 0 });
  if (hist.length > MAX_EQUITY_HISTORY) hist.shift();
  lastEquitySnapshot.set(accountId, now);
}

function getEquityHistory() {
  const result = {};
  equityHistory.forEach((hist, id) => {
    if (!masters.has(id) && !slaves.has(id)) return;
    result[id] = hist;
  });
  return result;
}

// ─── Sync Monitor ────────────────────────────────────────
function getSyncStatus() {
  const masterPositions = {};
  // Collect master position details
  masters.forEach((m, id) => {
    const details = m.info.positionDetails || [];
    masterPositions[id] = {
      accountId: id,
      count: m.info.positions || details.length,
      symbols: details.map(p => p.symbol),
      details: details,
    };
  });

  const slaveSync = [];
  slaves.forEach((s, id) => {
    const slaveDetails = s.info.positionDetails || [];
    const subscribedTo = s.subscribedTo || Object.keys(masterPositions)[0] || '';
    const masterData = masterPositions[subscribedTo] || { count: 0, symbols: [], details: [] };

    // Compare position counts
    const masterCount = masterData.count;
    const slaveCount = s.info.positions || slaveDetails.length;
    const isSynced = masterCount === slaveCount;

    // Find missing symbols
    const slaveSymbols = slaveDetails.map(p => p.symbol);
    const missingSymbols = masterData.symbols.filter(sym => !slaveSymbols.includes(sym));

    slaveSync.push({
      accountId: id,
      subscribedTo,
      masterPositions: masterCount,
      slavePositions: slaveCount,
      synced: isSynced,
      missing: masterCount - slaveCount,
      missingSymbols,
      slaveDetails,
    });
  });

  return { masters: masterPositions, slaves: slaveSync };
}

// ─── Risk Dashboard ──────────────────────────────────────
function getRiskMetrics() {
  const risks = [];
  const allAccounts = new Map([...masters, ...slaves]);

  allAccounts.forEach((acct, id) => {
    const positions = acct.info.positionDetails || [];
    const exposure = {};
    positions.forEach(p => {
      const sym = p.symbol || 'UNKNOWN';
      if (!exposure[sym]) exposure[sym] = { lots: 0, pnl: 0, count: 0 };
      exposure[sym].lots += p.lots || 0;
      exposure[sym].pnl += p.pnl || 0;
      exposure[sym].count++;
    });

    risks.push({
      accountId: id,
      role: masters.has(id) ? 'master' : 'slave',
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

// ─── Slippage Analysis ───────────────────────────────────
function getSlippageAnalysis() {
  // Analyze the last 200 signals that have fill prices
  const recentSignals = signalLog.slice(-200).filter(s => s.fillPrice > 0 && s.type && s.type.includes('OPEN'));

  if (recentSignals.length === 0) return { trades: [], avgSlippage: 0, maxSlippage: 0 };

  const trades = recentSignals.map(s => ({
    time: s.time,
    symbol: s.symbol,
    masterPrice: s.fillPrice,
    type: s.type,
    masterID: s.masterID,
  }));

  return { trades, totalSignals: recentSignals.length };
}

// ─── Persistence ─────────────────────────────────────────
function savePerformance() {
  try {
    const dir = path.dirname(CONFIG.performanceFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = {};
    accountPerf.forEach((v, k) => { data[k] = v; });
    fs.writeFileSync(CONFIG.performanceFile, JSON.stringify(data, null, 2), 'utf8');
    log('DEBUG', `Performance data saved (${accountPerf.size} accounts)`);
  } catch (e) {
    log('WARN', `Failed to save performance: ${e.message}`);
  }
}

function loadPerformance() {
  try {
    if (fs.existsSync(CONFIG.performanceFile)) {
      const raw = fs.readFileSync(CONFIG.performanceFile, 'utf8');
      const data = JSON.parse(raw);
      for (const [k, v] of Object.entries(data)) {
        accountPerf.set(k, v);
      }
      log('INFO', `Loaded performance data for ${accountPerf.size} accounts`);
    }
    if (fs.existsSync(CONFIG.historyFile)) {
      const raw = fs.readFileSync(CONFIG.historyFile, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        tradeHistory.push(...data);
      }
      log('INFO', `Loaded trade history with ${tradeHistory.length} records`);
    }
  } catch (e) {
    log('WARN', `Failed to load performance/history: ${e.message}`);
  }
}

// ★ PERF: Batched history save — max once per 5 seconds
let historySaveTimer = null;
function scheduleHistorySave() {
  if (historySaveTimer) return;
  historySaveTimer = setTimeout(() => {
    historySaveTimer = null;
    try {
      fs.writeFile(CONFIG.historyFile, JSON.stringify(tradeHistory), () => {});
    } catch (e) {
      log('WARN', `Failed to save history: ${e.message}`);
    }
  }, 5000);
}

// ─── Utility ─────────────────────────────────────────────
const https = require('https');
function sendTelegramMessage(text) {
  if (!CONFIG.telegramBotToken || !CONFIG.telegramChatId) return;
  const url = `https://api.telegram.org/bot${CONFIG.telegramBotToken}/sendMessage`;
  const data = JSON.stringify({ chat_id: CONFIG.telegramChatId, text, parse_mode: 'HTML' });
  const req = https.request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
  });
  req.on('error', (e) => log('WARN', `Telegram error: ${e.message}`));
  req.write(data);
  req.end();
}

function checkDailyReport() {
  const now = getBrokerDate();
  if (now.getHours() === 23 && now.getMinutes() === 59) {
    let totalPnl = 0, totalAum = 0, totalWins = 0, totalTradesCount = 0;
    const acctLines = [];
    accountPerf.forEach((perf, id) => {
      // Opt: filter out offline accounts from report as well, or report all? 
      // Usually all that traded should be in report. 
      const pnl = perf.dayStartBalance > 0 && perf.lastNetBalance !== undefined ? (perf.lastNetBalance - perf.dayStartNetBalance) + perf.floatingPnL : perf.floatingPnL;
      totalPnl += pnl;
      totalAum += perf.currentEquity;
      totalWins += perf.winTrades;
      totalTradesCount += perf.totalTrades;
      const emoji = pnl >= 0 ? '🟢' : '🔴';
      acctLines.push(`${emoji} ${id} (${perf.role === 'master' ? 'M' : 'S'}): $${pnl.toFixed(2)}`);
    });
    const winRate = totalTradesCount > 0 ? ((totalWins / totalTradesCount) * 100).toFixed(1) : '0.0';
    const msg = `📊 <b>CopyTrade Daily Summary</b>
📅 Date: ${now.toLocaleDateString('en-GB')}
━━━━━━━━━━━━━━━━━━━━
💰 Total AUM: $${totalAum.toFixed(2)}
📈 Total P&L: $${totalPnl.toFixed(2)}
🎯 Win Rate: ${winRate}%
⚡ Total Trades: ${totalTradesCount}
━━━━━━━━━━━━━━━━━━━━
${acctLines.join('\n')}
━━━━━━━━━━━━━━━━━━━━
⚠️ Alert: All systems operational.`;
    sendTelegramMessage(msg);
  }
}
setInterval(checkDailyReport, 60000); // Check once a minute
function log(level, msg) {
  const ts = new Date().toISOString().substr(11, 12);
  const prefix = { INFO: '✅', WARN: '⚠️', ERROR: '❌', DEBUG: '🔍' }[level] || '📝';
  console.log(`[${ts}] ${prefix} ${msg}`);
}

// ★ PERF: Throttle dashboard updates — max once per second regardless of heartbeat count
let dashboardUpdateTimer = null;
function scheduleDashboardUpdate() {
  if (dashboardUpdateTimer) return; // already scheduled
  dashboardUpdateTimer = setTimeout(() => {
    dashboardUpdateTimer = null;
    broadcastDashboard('status', getStatus());
    broadcastDashboard('performance', getPerformanceData());
  }, 1000);
}

function broadcastDashboard(type, data) {
  const msg = JSON.stringify({ type, data, timestamp: Date.now() });
  wsClients = wsClients.filter(ws => {
    try {
      if (ws.readyState === 1) { ws.send(msg); return true; }
      return false;
    } catch { return false; }
  });
}

function getStatus() {
  const masterList = [];
  masters.forEach((m, id) => {
    masterList.push({ id, connected: !m.socket.destroyed, lastHeartbeat: m.lastHeartbeat, info: m.info });
  });
  const slaveList = [];
  slaves.forEach((s, id) => {
    slaveList.push({ id, subscribedTo: s.subscribedTo, connected: !s.socket.destroyed, lastHeartbeat: s.lastHeartbeat, info: s.info });
  });
  return { masters: masterList, slaves: slaveList, signalCount: signalLog.length };
}

// ─── Length-Prefixed Protocol Parser ─────────────────────
function createParser(onMessage) {
  let buffer = Buffer.alloc(0);
  return function (chunk) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const msgLen = buffer.readUInt32BE(0);
      if (msgLen <= 0 || msgLen > 65536) {
        // Try to find JSON start as fallback
        const braceIdx = buffer.indexOf('{', 1);
        if (braceIdx > 0) {
          buffer = buffer.slice(braceIdx);
        } else {
          buffer = Buffer.alloc(0);
        }
        continue;
      }
      if (buffer.length < 4 + msgLen) break;
      const msgBuf = buffer.slice(4, 4 + msgLen);
      buffer = buffer.slice(4 + msgLen);
      try {
        const json = JSON.parse(msgBuf.toString('utf8'));
        onMessage(json);
      } catch (e) {
        log('WARN', `JSON parse error: ${e.message}`);
      }
    }
  };
}

// ─── Send length-prefixed message ────────────────────────
function sendMessage(socket, obj) {
  try {
    if (socket.destroyed) return false;
    const json = JSON.stringify(obj);
    const body = Buffer.from(json, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32BE(body.length, 0);
    socket.write(Buffer.concat([header, body]));
    return true;
  } catch (e) {
    log('ERROR', `Send failed: ${e.message}`);
    return false;
  }
}

// ─── TCP Server ──────────────────────────────────────────
const tcpServer = net.createServer((socket) => {
  const addr = `${socket.remoteAddress}:${socket.remotePort}`;
  let clientRole = null;
  let clientId = null;
  let authenticated = false;

  log('INFO', `New TCP connection from ${addr}`);

  socket.on('data', createParser((msg) => {
    // ─── Authentication ───
    if (msg.action === 'auth') {
      // ★ SECURITY: ตรวจสอบ auth token (ถ้าตั้งค่าไว้)
      if (CONFIG.authToken && msg.token !== CONFIG.authToken) {
        log('WARN', `Auth rejected from ${addr} — invalid token`);
        sendMessage(socket, { action: 'auth_fail', reason: 'Invalid auth token' });
        socket.destroy();
        return;
      }

      if (!msg.role || !msg.id) {
        log('WARN', `Auth rejected from ${addr} — missing role or id`);
        sendMessage(socket, { action: 'auth_fail', reason: 'Missing role or id' });
        socket.destroy();
        return;
      }

      clientRole = msg.role;
      clientId = msg.id;
      authenticated = true;

      if (clientRole === 'master') {
        masters.set(clientId, { socket, lastHeartbeat: Date.now(), info: { addr } });
        log('INFO', `Master "${clientId}" authenticated from ${addr}`);
      } else {
        slaves.set(clientId, { socket, lastHeartbeat: Date.now(), subscribedTo: '', info: { addr } });
        log('INFO', `Slave "${clientId}" authenticated from ${addr}`);
      }

      // Initialize performance tracking
      getOrCreatePerf(clientId, clientRole);

      sendMessage(socket, { action: 'auth_ok', id: clientId, role: clientRole });

      connectionLog.push({ time: Date.now(), event: 'connect', role: clientRole, id: clientId });
      broadcastDashboard('connection', { event: 'connect', role: clientRole, id: clientId });
      broadcastDashboard('status', getStatus());
      return;
    }

    if (!authenticated) {
      sendMessage(socket, { action: 'error', reason: 'Not authenticated' });
      return;
    }

    // ─── Subscribe (Slave subscribes to Master) ───
    if (msg.action === 'subscribe') {
      if (clientRole === 'slave') {
        const slave = slaves.get(clientId);
        if (slave) {
          slave.subscribedTo = msg.masterID;
          log('INFO', `Slave "${clientId}" subscribed to Master "${msg.masterID}"`);
          broadcastDashboard('status', getStatus());
        }
      }
      return;
    }

    // ─── Heartbeat ───
    if (msg.action === 'heartbeat') {
      let clientObj = null;
      if (clientRole === 'master' && masters.has(clientId)) {
        clientObj = masters.get(clientId);
      } else if (clientRole === 'slave' && slaves.has(clientId)) {
        clientObj = slaves.get(clientId);
      }

      if (clientObj) {
        clientObj.lastHeartbeat = Date.now();
        // Update financial metrics
        if (msg.balance !== undefined) clientObj.info.balance = msg.balance;
        if (msg.equity !== undefined) clientObj.info.equity = msg.equity;
        if (msg.marginLevel !== undefined) clientObj.info.marginLevel = msg.marginLevel;
        if (msg.marginUsed !== undefined) clientObj.info.marginUsed = msg.marginUsed;
        if (msg.freeMargin !== undefined) clientObj.info.freeMargin = msg.freeMargin;
        if (msg.floatingPnL !== undefined) clientObj.info.floatingPnL = msg.floatingPnL;
        if (msg.positions !== undefined) clientObj.info.positions = msg.positions;
        if (msg.positionDetails) clientObj.info.positionDetails = msg.positionDetails;
      }

      // ★ Update performance tracking
      updateAccountPerformance(clientId, clientRole, {
        balance: msg.balance,
        equity: msg.equity,
        marginLevel: msg.marginLevel,
        marginUsed: msg.marginUsed,
        freeMargin: msg.freeMargin,
        floatingPnL: msg.floatingPnL,
        positions: msg.positions,
        positionDetails: msg.positionDetails,
        cumulativeDW: msg.cumulativeDW,
      });

      // ★ Snapshot equity history (max 1 per 30s per account)
      snapshotEquityHistory(clientId, msg.equity || 0, msg.balance || 0);

      sendMessage(socket, { action: 'heartbeat', ts: Date.now() });
      // ★ PERF: Throttle broadcasts — schedule instead of sending on every heartbeat
      scheduleDashboardUpdate();
      return;
    }

    // ─── Signal from Master → Route to Slaves ───
    if (msg.action === 'signal' && clientRole === 'master') {
      const masterID = msg.mid || clientId;
      log('INFO', `Signal from Master "${masterID}": ${msg.type || 'unknown'} ${msg.sym || ''}`);

      // Log signal
      const signalEntry = {
        time: Date.now(),
        masterID,
        type: msg.type,
        symbol: msg.sym,
        lots: msg.lots,
        price: msg.price,
        fillPrice: msg.fp || msg.price,
        ticket: msg.ticket,
        fillTimeMs: 0,
      };
      signalLog.push(signalEntry);
      if (signalLog.length > CONFIG.maxSignalLog)
        signalLog.shift();

      if (msg.type && msg.type.includes('CLOSE')) {
        tradeHistory.unshift(signalEntry);
        if (tradeHistory.length > CONFIG.maxHistoryLog) tradeHistory.pop();
        // ★ PERF: Batch writes — schedule instead of writing on every close
        scheduleHistorySave();
      }

      // Route to subscribed slaves
      let routedCount = 0;
      slaves.forEach((slave, slaveId) => {
        if (slave.subscribedTo === masterID || slave.subscribedTo === '') {
          if (!slave.socket.destroyed) {
            sendMessage(slave.socket, msg);
            routedCount++;
          }
        }
      });

      log('INFO', `Signal routed to ${routedCount} slave(s)`);
      broadcastDashboard('signal', signalEntry);
      return;
    }
  }));

  socket.on('close', () => {
    log('INFO', `Connection closed: ${clientRole || 'unknown'} "${clientId || 'unknown'}" from ${addr}`);
    if (clientRole === 'master') masters.delete(clientId);
    if (clientRole === 'slave') slaves.delete(clientId);
    connectionLog.push({ time: Date.now(), event: 'disconnect', role: clientRole, id: clientId });
    broadcastDashboard('connection', { event: 'disconnect', role: clientRole, id: clientId });
    broadcastDashboard('status', getStatus());
  });

  socket.on('error', (err) => {
    log('ERROR', `Socket error from ${addr}: ${err.message}`);
  });
});

// ─── Heartbeat checker ───────────────────────────────────
setInterval(() => {
  const now = Date.now();
  masters.forEach((m, id) => {
    if (now - m.lastHeartbeat > CONFIG.heartbeatTimeout) {
      log('WARN', `Master "${id}" heartbeat timeout — disconnecting`);
      m.socket.destroy();
      masters.delete(id);
    }
  });
  slaves.forEach((s, id) => {
    if (now - s.lastHeartbeat > CONFIG.heartbeatTimeout) {
      log('WARN', `Slave "${id}" heartbeat timeout — disconnecting`);
      s.socket.destroy();
      slaves.delete(id);
    }
  });
}, 10000);

// ─── Performance auto-save ───────────────────────────────
setInterval(savePerformance, CONFIG.performanceSaveInterval);

// ─── HTTP + WebSocket Server ─────────────────────────────
let WebSocket;
try {
  WebSocket = require('ws');
} catch {
  log('WARN', 'ws package not installed — run: npm install ws');
}

const httpServer = http.createServer((req, res) => {
  // Extract passcode if set from header or query
  const checkAuth = () => {
    const headerCode = req.headers['x-passcode'];
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `http://${host}`);
    const queryCode = url.searchParams.get('passcode');
    if (CONFIG.dashboardPasscode && headerCode !== CONFIG.dashboardPasscode && queryCode !== CONFIG.dashboardPasscode) {
      return false;
    }
    return true;
  };

  const host = req.headers.host || 'localhost';
  const currentUrl = new URL(req.url, `http://${host}`);
  const pathname = currentUrl.pathname;

  // Simple endpoint to check if pass is correct
  if (pathname === '/api/auth_check') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: checkAuth() }));
    return;
  }

  // API endpoints
  if (pathname === '/api/status') {
    if (!checkAuth()) return res.writeHead(401), res.end('Unauthorized');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(getStatus()));
    return;
  }

  if (pathname === '/api/signals') {
    if (!checkAuth()) return res.writeHead(401), res.end('Unauthorized');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(signalLog.slice(-100)));
    return;
  }

  if (pathname === '/api/history') {
    if (!checkAuth()) return res.writeHead(401), res.end('Unauthorized');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(tradeHistory.slice(0, 500)));
    return;
  }

  if (pathname === '/api/performance') {
    if (!checkAuth()) return res.writeHead(401), res.end('Unauthorized');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(getPerformanceData()));
    return;
  }

  // Reset all performance stats
  if (pathname === '/api/reset-performance') {
    if (!checkAuth()) return res.writeHead(401), res.end('Unauthorized');
    const acctId = currentUrl.searchParams.get('account') || null;
    resetPerformanceStats(acctId);
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, message: acctId ? `Reset account ${acctId}` : 'Reset ALL accounts' }));
    const perfPayload = JSON.stringify({ type: 'performance', data: getPerformanceData(), timestamp: Date.now() });
    wsClients.forEach(c => { try { c.send(perfPayload); } catch(e){} });
    return;
  }

  // Sync monitor
  if (pathname === '/api/sync') {
    if (!checkAuth()) return res.writeHead(401), res.end('Unauthorized');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(getSyncStatus()));
    return;
  }

  // Equity history for charts
  if (pathname === '/api/equity-history') {
    if (!checkAuth()) return res.writeHead(401), res.end('Unauthorized');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(getEquityHistory()));
    return;
  }

  // Risk metrics
  if (pathname === '/api/risk') {
    if (!checkAuth()) return res.writeHead(401), res.end('Unauthorized');
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(getRiskMetrics()));
    return;
  }

  // Position details (all accounts)
  if (pathname === '/api/positions') {
    if (!checkAuth()) return res.writeHead(401), res.end('Unauthorized');
    const positions = {};
    masters.forEach((m, id) => { positions[id] = { role: 'master', details: m.info.positionDetails || [] }; });
    slaves.forEach((s, id) => { positions[id] = { role: 'slave', details: s.info.positionDetails || [] }; });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(positions));
    return;
  }


  // Serve dashboard — ★ SECURITY: ป้องกัน path traversal
  const publicDir = path.join(__dirname, 'public');
  let filePath = pathname === '/' ? '/dashboard.html' : pathname;
  filePath = path.resolve(publicDir, '.' + filePath);

  // Block any path that escapes the public directory
  if (!filePath.startsWith(publicDir)) {
    log('WARN', `Blocked path traversal attempt: ${pathname}`);
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

// WebSocket for dashboard
if (WebSocket) {
  const wss = new WebSocket.Server({ server: httpServer });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('passcode');
    if (CONFIG.dashboardPasscode && token !== CONFIG.dashboardPasscode) {
      log('WARN', 'Rejected WS connection due to invalid passcode');
      ws.close(4001, 'Unauthorized');
      return;
    }
    log('INFO', 'Dashboard WebSocket connected');
    wsClients.push(ws);
    // Send initial data for all tabs
    ws.send(JSON.stringify({ type: 'status', data: getStatus(), timestamp: Date.now() }));
    ws.send(JSON.stringify({ type: 'signalHistory', data: signalLog.slice(-50), timestamp: Date.now() }));
    ws.send(JSON.stringify({ type: 'tradeHistory', data: tradeHistory.slice(0, 100), timestamp: Date.now() }));
    ws.send(JSON.stringify({ type: 'performance', data: getPerformanceData(), timestamp: Date.now() }));
    ws.send(JSON.stringify({ type: 'sync', data: getSyncStatus(), timestamp: Date.now() }));
    ws.send(JSON.stringify({ type: 'risk', data: getRiskMetrics(), timestamp: Date.now() }));
    ws.send(JSON.stringify({ type: 'equityHistory', data: getEquityHistory(), timestamp: Date.now() }));

    ws.on('close', () => {
      wsClients = wsClients.filter(c => c !== ws);
    });
  });
}

// ─── Start Servers ───────────────────────────────────────
loadPerformance();

tcpServer.listen(CONFIG.tcpPort, '0.0.0.0', () => {
  console.log('');
  console.log('  ═══════════════════════════════════════════════');
  console.log('  ║  CopyTrade Relay Server v1.2                ║');
  console.log('  ║  + Per-Account Performance Tracking         ║');
  console.log('  ═══════════════════════════════════════════════');
  console.log(`  ║  TCP Port  : ${CONFIG.tcpPort} (Master/Slave EA)`);
  console.log(`  ║  HTTP Port : ${CONFIG.httpPort} (Web Dashboard)`);
  console.log(`  ║  Auth Token: ${CONFIG.authToken.substr(0, 4)}****`);
  console.log('  ═══════════════════════════════════════════════');
  console.log('');
});

httpServer.listen(CONFIG.httpPort, '0.0.0.0', () => {
  log('INFO', `Dashboard: http://localhost:${CONFIG.httpPort}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  log('INFO', 'Shutting down...');
  savePerformance();
  tcpServer.close();
  httpServer.close();
  masters.forEach(m => m.socket.destroy());
  slaves.forEach(s => s.socket.destroy());
  process.exit(0);
});
