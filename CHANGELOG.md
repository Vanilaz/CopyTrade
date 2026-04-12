# Changelog

## v3.0.5 — Slave Tracking & Relationship Visualization (2026-04-12)

**Slave Tracking Visualization (ใหม่!):**
- **Relationship Mapping:** เพิ่มการแสดงผล "FOLLOWING: MST_[ID]" ภายใต้เลขบัญชี Slave ในหน้า Overview เพื่อให้ผู้ใช้ทราบทันทีว่า Slave แต่ละตัวกำลังติดตาม Master รายใด
- **Backend Data Integration:** ปรับปรุง Domain Entity และ Performance Tracker ให้สามารถดึงข้อมูลการสมัครสมาชิก (Subscription) จาก Account Store และส่งผ่าน WebSocket มายัง Dashboard ได้แบบเรียลไทม์
- **Zero-Latency Display:** ข้อมูลการติดตามจะถูกอัปเดตทันทีเมื่อมีการสมัครสัญญาณ หรือมีการเปลี่ยน Master บนตัว EA

---

## v3.0.4 — Institutional HUD Architecture Overhaul (2026-04-11)

**Neural HUD Design System (ใหม่!):**
- **HUD Layout Architecture:** ปรับปรุงโครงสร้าง Layout เป็นแบบ Hybrid (Sidebar Command Center + Topbar System Matrix) เพื่อเพิ่มพื้นที่การแสดงผลข้อมูลแบบความหนาแน่นสูง
- **Premium HUD Elements:** เพิ่มเอฟเฟกต์ **Corner Brackets**, **Scanning Lines**, และ **Mesh Gradient Backgrounds** ทุกแผงวงจรข้อมูล ให้ความรู้สึกเหมือนหน้าจอควบคุมระดับสถาบันการเงิน
- **Terminal Aesthetics:** ปรับปรุง Typography และ Color Palette เข้าสู่โหมด Cyber-Minimalist เน้นความชัดเจนของตัวเลข (Monospace Focus) และสถานะ Telemetry
- **Institutional Tabs Overhaul:**
    - **Overview:** ปรับปรุง Bento Grid ให้มีความเป็น Terminal มากขึ้น พร้อมเอฟเฟกต์ Glow และสถาปัตยกรรมข้อมูลที่ลดความซับซ้อนแต่เพิ่มความแม่นยำ
    - **Performance:** หน้า Matrix เทรดแบบขยาย (Accordion) รองรับการแสดงผล HUD Decorations และกราฟ Equity ขนาดเล็กในแถว
    - **Monitor & History:** ปรับปรุงสีสันและแอนิเมชันให้สอดคล้องกับธีม HUD ทั้งระบบ

**Progressive Web App (PWA) Support:**
- **Installable Dashboard:** รองรับการติดตั้งเป็น Application บนเครื่อง (Desktop/Mobile) ผ่าน `vite-plugin-pwa`
- **Offline Capability:** มาพร้อม Service Worker เบื้องต้นเพื่อความเสถียรในการโหลดทรัพยากรหน้าเว็บ
- **Custom Manifest:** ไอคอนและชื่อแอปที่ปรับแต่งมาเพื่อลุคระดับพรีเมียมบนหน้า Home Screen

---

## v3.0.3 — Prop Firm / SaaS Dashboard Upgrade (2026-04-11)

**Institutional Dashboard Analytics (ใหม่!):**
- **Overview KPIs:** หน้า Overview อัปเกรดเป็นศูนย์ควบคุมกองทุนขนาดย่อม ดึงสถานะ Win Rate ภาพรวมระบบ และ Realized PnL จาก History ได้แบบเรียลไทม์
- **Symbol Profitability Matrix:** เพิ่ม PnL By Symbol Bar Chart ระดับมืออาชีพ ช่วยแยกให้เห็นชัดเจนว่าเทรดคู่ไหนในตอนนี้สร้าง Net Profit หรือ Loss
- **Top Performer Recognition:** แสดงโล่ระดับท็อป (Crown) บน Master/Slave ที่ทำกำไรช่วง Floating ได้สูงสุด
- **Dynamic Trade Ledger:** หน้า History Tab อัปเกรดแบบยกแผง ใส่ KPI Banners ที่สรุป Trade ยอดเยี่ยม, แย่ที่สุด, ลำดับ Win Rate, และยอดรวมสุทธิ พร้อมระบบ Search & Filter อัจฉริยะแบบเรียลไทม์
- **Daily Drawdown Guard:** หน้า Performance Tab แสดงหลอดสัดส่วน % แบกรับความเสี่ยงรายวันเทียบ Balance หากเกิน 5% ไฟสถานะจะขึ้นสีแดง/เหลือง/เขียว พร้อมปุ่มกดขยาย (Accordion UI) ดูความเสี่ยงรายออเดอร์
- **SVG In-row Sparklines:** สร้างกราฟเส้น Equity ภายในตารางตั๋ว Performance โชว์มิติของกราฟบัญชีโดยตรงในช่องเดียว
- **Sync Auditor & Monitor Upgrade:** โละ Mock Status ในหน้า Monitor ออกทั้งหมด! เชื่อม Sync Info ตรวจจับการหลุดซิงก์ (Desynced/Missing Trades) หรือตรวจสอบ Routing Delay (Fill Price vs Pending) จาก Backend ของจริง 100%

**Backend Performance Optimization:**
- **EquityTracker:** แก้ MAX_HISTORY จาก 2880 (48 นาที) เป็นระบบ Adaptive Downsample (1s สำหรับชั่วโมงล่าสุด, 10s สำหรับข้อมูลเก่า, Hard cap 5000 จุด ~4 ชม.)
- **DashboardBroadcaster:** เพิ่ม Error Isolation — หาก JSON.stringify ล้มเหลว จะไม่กระทบ broadcast pipeline ทั้งหมด
- **ProcessHeartbeat:** แยก Equity Chart (ข้อมูลหนัก) ออกจาก Status/Perf/Sync/Risk (ข้อมูลเบา) — ลด bandwidth 80%
- **Scheduler:** ลด Heartbeat Check จาก 10s → 5s เพื่อตรวจจับ Disconnect เร็วขึ้น 2x

**MQL5 Cross-Broker Price Matching (ใหม่!):**
- **Adaptive Slippage:** ระบบปรับ Deviation อัตโนมัติตามประเภท Symbol (XAU/GOLD = 2x, US30/NAS = 3x, Forex = ปกติ)
- **EXEC_LIMIT_CHASE Fix:** แก้โหมด Limit Chase ให้วาง Limit Order ที่ราคา Master เป๊ะจริงๆ แทนที่จะทำเหมือน Match Master
- **Tier 2 ขยาย:** เพิ่มช่วง Tier 2 จาก 5x → 8x ของ deviation เพื่อรองรับ Cross-Broker ที่ราคาต่างกันมาก
- **Retry Speed:** ลด retry delay จาก 150ms → 100ms

---

## v3.0.2 — TradingView Experience & Live Neural Relay (2026-04-11)

**Live Dashboard Overhaul (ใหม่!):**
- **TradingView Experience:** ปรับปรุงความถี่ของข้อมูลพอร์ต (Equity) จาก 10 วินาที เป็น **1 วินาที** (Ultra-high fidelity)
- **High-Frequency Broadcast:** ลดการหน่วงเวลาการส่งข้อมูล (Broadcast throttle) จาก 1s เหลือ **200ms** (5 ครั้งต่อวินาที)
- **Visual Ticker Flash:** เพิ่มเอฟเฟกต์กระพริบเขียว/แดง (Flash Up/Down) เมื่อค่ากำไร/ขาดทุนเปลี่ยนในหน้า Dashboard
- **Auto-Reconnection:** เพิ่มระบบตรวจสอบและเชื่อมต่อ WebSocket ใหม่โดยอัตโนมัติภายใน 3 วินาทีเมื่อการเชื่อมต่อหลุด
- **Live Pulse Indicators:** เพิ่มแอนิเมชัน Pulsating Live Dot และวงแหวนประมวลผล (Neural Pulse) รอบสถานะระบบ
- **Instant Signal Injection:** เมื่อมีสัญญาณใหม่ ข้อมูลจะถูกฉีดเข้าสู่ UI ทันทีแบบวินาทีต่อวินาที

**Fixes:**
- แก้ไขบั๊กจอดำ (TypeError: e.reduce) ในหน้า Monitor โดยการ Flatten ข้อมูล EquityHistory ก่อนส่ง
- แก้ปัญหา Dashboard ค้างต้องกด F5 เองหลัง Deploy โดยใช้ Reconnection Loop

---

## v3.0.1 — Clean Architecture Bug Fixes (2026-04-11)

**Critical Fixes:**
- **Telegram Daily Report:** ปรับปรุง `PerformanceTracker` และ `scheduler.ts` ให้คัดเลือกเฉพาะ Master/Slave account ที่กำลังออนไลน์อยู่เท่านั้น (ป้องกันการส่งแจ้งเตือน EA ที่ไม่ได้ Connect/โดนลบ)
- **Monitor Dashboard Crash (จอดำ):** แก้ไข React component `RiskDashboard.tsx` ให้ป้องกันกรณี `data` เป็น null หรือ undefined ก่อน initial WebSocket payload จะส่งข้อมูลมาถึง

---

## v3.0 — Cloud Deploy + Clean Architecture (2026-04-10)

**Cloud Deploy (ใหม่!):**
- รองรับ Deploy ฟรีบน **Render.com** (แนะนำ) และ **Vercel** (Serverless)
- เพิ่ม `render.yaml` — กดปุ่มเดียว deploy ทั้ง server
- เพิ่ม `Dockerfile` — รองรับ Container deployment (Railway, Fly.io, etc.)
- เพิ่ม `vercel.json` — Serverless deployment (HTTP-only mode)
- Server รองรับ **HTTP-ONLY mode** (`HTTP_ONLY=true`) สำหรับ Serverless platform
- ใช้ `PORT` environment variable อัตโนมัติ (Render/Vercel กำหนดให้)

**HTTP Transport (ใหม่!):**
- เพิ่ม `HttpTransport.mqh` — ใช้ `WebRequest()` สื่อสารผ่าน HTTP แทน TCP Socket
- EA API endpoints: `/api/ea/auth`, `/api/ea/heartbeat`, `/api/ea/signal`, `/api/ea/poll`, `/api/ea/subscribe`
- Master ส่ง signal ผ่าน HTTP POST, Slave poll ผ่าน HTTP GET
- เพิ่ม `COPY_HTTP` mode ใน `ENUM_COPY_MODE` — เลือกได้ใน EA input
- เพิ่ม SSE (Server-Sent Events) endpoint สำหรับ Dashboard บน Serverless
- Health check endpoint `/health` สำหรับ monitoring

**Security Hardening:**
- ลบ hardcoded Telegram token ออก — ใช้ Environment Variables เท่านั้น
- เพิ่ม TCP auth token validation — ตรวจ token ก่อน accept connection
- แก้ Path Traversal vulnerability ใน HTTP static file serving
- เพิ่ม `InpAuthToken` input parameter ใน Master/Slave EA

**Performance:**
- Throttle dashboard broadcasts สูงสุด 1 ครั้ง/วินาที (เดิมทุก heartbeat)
- Batch history file writes ทุก 5 วินาที (ป้องกัน concurrent write)
- `GetCumulativeDW()` scan แบบ incremental — O(1) ปกติ, O(n) เฉพาะเมื่อมี DW ใหม่
- `NormalizeLot` คำนวณ precision จาก stepLot แบบ dynamic (เดิม hardcode 2 ทศนิยม)

---

## v1.2 — Cross-Broker Precision & Dashboard Overhaul (2026-04-10)

**แก้ไขบั๊กร้ายแรง (Critical Fixes):**

- **Deviation ถูกเขียนทับ (TradeExecutor.mqh):**  
  `SetDeviationInPoints(m_slippage)` รันหลังจาก match mode คำนวณ deviation เสร็จ → เขียนทับค่าที่คำนวณไว้ → `EXEC_MATCH_MASTER` **ไม่ทำงานเลย** ทุก order ออก market ด้วย default 20pt  
  → ย้ายเข้า `else` branch ให้ใช้เฉพาะเมื่อไม่ได้ใช้ match mode

- **Latency ข้าม Broker คำนวณผิด (TradeExecutor.mqh):**  
  ใช้ `GetTickCount64()` (system uptime ของเครื่อง) วัด latency ระหว่าง Master กับ Slave → **คนละเครื่อง uptime ไม่เกี่ยวกัน** → ได้ latency เป็นพันล้าน ms → Tier 2 (ลอง master price) ไม่เคยทำงาน → fallback เป็น market ทุกครั้ง  
  → เปลี่ยนเป็น `TimeCurrent()` (broker server time ที่ sync กันข้าม broker)  
  → ลบ latency gate จาก Tier 2 → ลอง master price เสมอ ไม่ว่า latency จะเท่าไหร่

- **Position เก่า sync ราคาไม่ตรง (CopyTradeMaster.mq5):**  
  Master มี position เปิดอยู่ก่อน → รัน EA → Safety Net ส่ง SIGNAL_OPEN ทุกตัว → Slave เปิดไม้ใหม่ที่ราคาตลาดปัจจุบัน → **ราคาต่างจากที่ Master เปิดเดิม**  
  → เพิ่ม `InpSyncExisting` (default: `false`) → mark position เดิมเป็น "signaled" → ไม่ sync ไปให้ Slave

- **WebSocket สร้างคู่ (dashboard.html):**  
  `connectWebSocket()` ถูกเรียก 2 ที่ (ใน auth check + ท้าย script) → สร้าง WS 2 connection → ข้อมูลทุกอย่าง render ซ้ำ 2 รอบ  
  → เรียกที่เดียว + เพิ่ม guard ป้องกัน connection ซ้ำ

**แก้ไข Dashboard แสดงข้อมูลผิด:**

- **Latency แสดงตัวเลขมั่ว:**  
  Signal Terminal แสดง `fillTimeMs` ดิบ (ค่า GetTickCount64 = system uptime เช่น 1,775,728,930,212 ms) เป็น "latency" → ตัวเลขไม่มีความหมาย  
  → ลบออก เปลี่ยนเป็นแสดง signal age ด้วย `timeAgo()` (เช่น "3s ago", "2m ago")

- **History Tab แสดง Role ผิด:**  
  ใช้ `masterID.startsWith('M')` ตรวจว่า Master หรือ Slave → masterID เป็นเลขบัญชี เช่น "97035207" → ไม่เคยขึ้นต้นด้วย 'M' → **ทุกแถวแสดงเป็น Slave**  
  → แก้เป็นแสดง "M" เสมอ (signal มาจาก Master ทั้งหมด)

- **Master Panel ไม่แสดง Balance/Equity/PnL:**  
  Slave Panel แสดงข้อมูลการเงินครบ แต่ Master Panel แสดงแค่ Margin Level กับ Positions  
  → เพิ่ม Balance, Equity, Floating PnL ให้ Master Panel เหมือน Slave

- **"Ping:" label ไม่ตรง:**  
  เขียน "Ping:" แต่แสดง timestamp ของ heartbeat ล่าสุด (วันที่) ไม่ใช่ network latency  
  → เปลี่ยนเป็น "Last seen:" + แสดงเวลาผ่านไป (เช่น "5s ago")

- **Drawdown แสดงไม่ถูก:**  
  คอลัมน์ Drawdown แสดง `currentDD` (DD ณ ตอนนี้) ซึ่งไม่ค่อยมีประโยชน์  
  → เปลี่ยนเป็นแสดง `maxDrawdownPct` (DD สูงสุดตลอดกาล) เป็นค่าหลัก + currentDD เป็นค่ารอง

- **Signal Count เพิ่มเรื่อยๆ ไม่ตรง:**  
  Client-side increment ทุกครั้งที่รับ signal → เลื่อนไหลไม่ตรงกับ server  
  → ใช้ `status.signalCount` จาก server โดยตรง

- **Reset Stats ไม่ refresh หน้า:**  
  กด Reset แล้วขึ้น alert "สำเร็จ" แต่ข้อมูลยังค้างเก่า  
  → เพิ่ม `location.reload()` หลัง reset สำเร็จ

**ปรับปรุง Latency (ลด worst-case จาก ~350ms เหลือ ~160ms):**

| จุดที่ปรับ | เดิม | ใหม่ |
|---|---|---|
| HistoryDealSelect retry | 10 ครั้ง x 20ms = 200ms | 20 ครั้ง x 5ms = 100ms |
| CT_POLL_MS (file polling) | 100ms | 50ms |
| SocketRead timeout | 50ms | 10ms |
| Slave Timer interval | 100ms | 50ms |
| TradeExecutor retryDelay | 500ms | 150ms |
| InpMatchSlippage default | 5 points (แน่นเกินสำหรับ Gold) | 30 points |
| InpStalePriceMs | 2000ms | 5000ms (เผื่อ cross-broker) |

**ปรับปรุงอื่นๆ:**

- **Server (server.js):** เพิ่ม equity history tracking, sync monitor, risk metrics, reset-performance API
- **JsonHelper.mqh:** แก้ positionDetails JSON ที่ comma ผิดตำแหน่ง → `[{...},,{...}]`
- **Telegram Daily Report (server.js):** `'\\n'` (backslash ตัวอักษร) → `'\n'` (ขึ้นบรรทัดใหม่จริง)
- **Dead Code Cleanup:** ลบ `formatPnL` function ที่ไม่ได้ใช้ออกจาก dashboard

---

## v1.1 — Signal Reliability Patch (2026-04-09)

**Critical Fixes:**
- **Signal ID Collision:** `signalID = GetTickCount64()` ทำให้หลาย signal ได้ชื่อไฟล์เดียวกัน → ไฟล์ทับกัน → signal หาย  
  → แก้เป็น Atomic Counter ที่ unique ทุกตัว
- **HistoryDealSelect Race:** `OnTradeTransaction` อาจ fire ก่อน Deal พร้อมใน History → signal ไม่ถูกส่ง  
  → เพิ่ม retry 10 ครั้ง (ทุก 20ms, สูงสุด 200ms)
- **FILE_COMMON Path Mismatch:** Master เขียน Common Files แต่ Slave ค้นหาใน Local Files  
  → ทั้งคู่ใช้ FILE_COMMON เสมอ
- **Sequential Dedup Bug:** `lastReadSignalID` ข้ามสัญญาณเมื่อ File System คืนไฟล์ไม่เรียงลำดับ  
  → เปลี่ยนเป็น Set-Based Dedup (500 IDs)

**Improvements:**
- **Safety Net:** `CheckNewPositions()` ตรวจจับ Position ที่ OnTradeTransaction พลาด (ทุก 100ms)
- **Auto-Sync on Restart:** Master restart → ส่ง SIGNAL_OPEN ทุก Position → Slave กรอง duplicate
- **Filling Mode Auto-Detect:** ตรวจจับ IOC/FOK/RETURN จาก `SYMBOL_FILLING_MODE` แทน hard-code

---

## v1.0 — Initial Release (2026-04-08)
- Local & Remote Copy Trade
- Fuzzy Deep Scan Symbol Mapper
- Price Matching (EXEC_MATCH_MASTER)
- Web Dashboard (Bento UI)
- Pending Order Support
