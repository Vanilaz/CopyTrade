/**
 * ═══════════════════════════════════════════════════════
 *  CopyTrade Relay Server v1.0
 *  TCP Hub สำหรับ Master/Slave + WebSocket Dashboard
 * ═══════════════════════════════════════════════════════
 */

const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ─── Configuration ───────────────────────────────────────
const CONFIG = {
  tcpPort: parseInt(process.env.TCP_PORT) || 5555,
  httpPort: parseInt(process.env.HTTP_PORT) || 8080,
  authToken: process.env.AUTH_TOKEN || 'copytrade2025',
  heartbeatTimeout: 30000, // 30s no heartbeat = disconnect
  maxSignalLog: 500,
};

// ─── State ───────────────────────────────────────────────
const masters = new Map();      // id -> { socket, lastHeartbeat, info }
const slaves = new Map();       // id -> { socket, lastHeartbeat, subscribedTo, info }
const signalLog = [];           // Recent signals for dashboard
const connectionLog = [];       // Connection events
let wsClients = [];             // WebSocket dashboard clients

// ─── Utility ─────────────────────────────────────────────
function log(level, msg) {
  const ts = new Date().toISOString().substr(11, 12);
  const prefix = { INFO: '✅', WARN: '⚠️', ERROR: '❌', DEBUG: '🔍' }[level] || '📝';
  console.log(`[${ts}] ${prefix} ${msg}`);
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
    masterList.push({ id, connected: !m.socket.destroyed, lastHeartbeat: m.lastHeartbeat });
  });
  const slaveList = [];
  slaves.forEach((s, id) => {
    slaveList.push({ id, subscribedTo: s.subscribedTo, connected: !s.socket.destroyed, lastHeartbeat: s.lastHeartbeat });
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
      // Auth token check removed

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
      if (clientRole === 'master' && masters.has(clientId)) {
        masters.get(clientId).lastHeartbeat = Date.now();
      } else if (clientRole === 'slave' && slaves.has(clientId)) {
        slaves.get(clientId).lastHeartbeat = Date.now();
      }
      sendMessage(socket, { action: 'heartbeat', ts: Date.now() });
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
        fillTimeMs: msg.ftMs,
      };
      signalLog.push(signalEntry);
      if (signalLog.length > CONFIG.maxSignalLog)
        signalLog.shift();

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

// ─── HTTP + WebSocket Server ─────────────────────────────
let WebSocket;
try {
  WebSocket = require('ws');
} catch {
  log('WARN', 'ws package not installed — run: npm install ws');
}

const httpServer = http.createServer((req, res) => {
  // API endpoints
  if (req.url === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(getStatus()));
    return;
  }

  if (req.url === '/api/signals') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(signalLog.slice(-100)));
    return;
  }

  // Serve dashboard
  let filePath = req.url === '/' ? '/dashboard.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

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
  wss.on('connection', (ws) => {
    log('INFO', 'Dashboard WebSocket connected');
    wsClients.push(ws);
    // Send initial status
    ws.send(JSON.stringify({ type: 'status', data: getStatus(), timestamp: Date.now() }));
    ws.send(JSON.stringify({ type: 'signalHistory', data: signalLog.slice(-50), timestamp: Date.now() }));

    ws.on('close', () => {
      wsClients = wsClients.filter(c => c !== ws);
    });
  });
}

// ─── Start Servers ───────────────────────────────────────
tcpServer.listen(CONFIG.tcpPort, '0.0.0.0', () => {
  console.log('');
  console.log('  ═══════════════════════════════════════════════');
  console.log('  ║  CopyTrade Relay Server v1.0                ║');
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
  tcpServer.close();
  httpServer.close();
  masters.forEach(m => m.socket.destroy());
  slaves.forEach(s => s.socket.destroy());
  process.exit(0);
});
