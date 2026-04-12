# CopyTrade MT5 — ระบบ Copy Trade ข้ามเครื่อง ข้าม Broker (Institutional Grade)

> **Version 3.0.6** — UI Refinement & Institutional Stabilization  
> สถาปัตยกรรมใหม่ Neural HUD, Hybrid Console Layout, Progressive Web App (Installable), React 19

---

## 🎯 ความสามารถหลัก

| Feature | รายละเอียด |
|---|---|
| ✅ **Fuzzy Deep Scan** | จับคู่ชื่อ Symbol ข้าม Broker อัตโนมัติ (เช่น XAUUSD -> XAUUSD.std) |
| ✅ **Local Copy** | Copy ในเครื่องเดียวกัน / VPS เดียวกัน ผ่าน Shared Files (เร็ว <10ms) |
| ✅ **Remote Copy** | Copy ข้าม VPS ผ่าน TCP Socket + Relay Server |
| ✅ **Price Matching** | จับราคา fill จริงของ Master ส่งให้ Slave ด้วย deviation 30 pt |
| ✅ **Auto Account ID** | ผูกระบบด้วยเลขบัญชีเข้าเทรด Master ทันที |
| ✅ **Exact Match SL/TP** | คำนวณ SL/TP ให้ Slave ตรงกับ Master เป๊ะๆ |
| ✅ **Auto-Reconnect** | เน็ตหลุด/เซิร์ฟเวอร์รีสตาร์ท EA จะเชื่อมต่อกลับอัตโนมัติ |
| ✅ **Safety Net** | ตรวจจับ Position ที่หลุดจาก OnTradeTransaction อัตโนมัติ |
| ✅ **Smart Sync** | เลือก sync position เดิม หรือ copy เฉพาะไม้ใหม่ |
| ✅ **Bento Dashboard** | React 19 + Glassmorphism — แสดงสถานะบัญชีแบบ Real-time |
| ✅ **Prop Firm Analytics** | ระบบคำนวณ Win Rate, Total Realized PnL, PnL by Symbol Bar Chart สดๆ |
| ✅ **Drawdown Guard** | ระบบแสดง % Drawdown ถอยหลังสู่ 5% ของเงินทุนรายวันแบบ Real-time |
| ✅ **Sync Auditor** | ติดตามสถานะ Master-Slave ตรวจสอบไม้หาย/สถานะเลียนแบบได้สมบูรณ์แบบระดับ ms |
| ✅ **Slave Tracking:** | **Neural Relationship Logging:** แสดงผล Master ID ที่ Slave กำลังติดตามอยู่บน Dashboard ทันที ช่วยให้การตรวจสอบโครงข่ายการเทรด (Node Cluster) ทำได้ง่ายและแม่นยำขึ้น |
| ✅ **✨ ฟีเจอร์ใหม่ระดับ Institutional HUD (v3.0.6):** | **Borderless Glassmorphism:** นำเส้นขอบ (Borders) ที่รบกวนสายตาออก เพื่อความคลีนและโฟกัสที่ข้อมูล Telemetry ได้ดียิ่งขึ้น <br> **Neural HUD Interface:** หน้าตาโปรแกรมสไตล์ Terminal กึ่งโปร่งใส พร้อมเส้นสแกนและมุมฉากระดับมืออาชีพ <br> **PWA Installation:** ติดตั้ง Dashboard เป็นแอปพลิเคชันแยกได้ทันที <br> **Hybrid Console Layout:** แยกส่วนควบคุมและส่วนจัดการพอร์ตออกจากกันอย่างชัดเจน |
| ✅ **HTTP Transport** | รองรับ WebRequest สำหรับ Cloud/Serverless |
| ✅ **Auth Token** | ป้องกัน Unauthorized Access ทั้ง TCP และ HTTP |
| ✅ **Clean Architecture** | Hexagonal Pattern — แยก Domain, Application, Adapters ชัดเจน |
| ✅ **TypeScript** | Type-safe ทั้งระบบ Frontend + Backend |
| ✅ **Neural Relay** | ระบบกระจายข้อมูลความถี่สูง (Sub-second) ไปยัง Dashboard ทุก Client |

---

## 🏗️ สถาปัตยกรรม (Architecture)

```
  ═══════════════════════════════════════════════════
   Clean Architecture — Hexagonal Pattern (v3.0)
  ═══════════════════════════════════════════════════

  ┌─────────────────────────────────────────────────┐
  │              Inbound Adapters                   │
  │   ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
  │   │   TCP    │ │   HTTP   │ │   WebSocket   │  │
  │   │  (EAs)  │ │  (API)   │ │  (Dashboard)  │  │
  │   └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
  │        │             │              │           │
  ├────────▼─────────────▼──────────────▼───────────┤
  │              Application Layer                  │
  │   ┌──────────────┐ ┌──────────────────────────┐ │
  │   │AuthenticateEA│ │ProcessHeartbeat/Signal   │ │
  │   │GetDashboard  │ │ResetPerformance          │ │
  │   └──────┬───────┘ └───────────┬──────────────┘ │
  │          │                     │                │
  ├──────────▼─────────────────────▼────────────────┤
  │              Domain Layer (Pure Logic)          │
  │   ┌──────────────┐ ┌──────────────────────────┐ │
  │   │ Entities     │ │ Services                 │ │
  │   │ Account      │ │ PerformanceTracker       │ │
  │   │ Signal       │ │ SignalRouter             │ │
  │   │ Performance  │ │ SyncChecker              │ │
  │   │              │ │ RiskCalculator           │ │
  │   │ Ports (I/F)  │ │ EquityTracker            │ │
  │   └──────────────┘ └──────────────────────────┘ │
  │                                                 │
  ├─────────────────────────────────────────────────┤
  │              Outbound Adapters                  │
  │   ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
  │   │ InMemory │ │   File   │ │   Telegram    │  │
  │   │  Stores  │ │ Storage  │ │   Notifier    │  │
  │   └──────────┘ └──────────┘ └───────────────┘  │
  └─────────────────────────────────────────────────┘
```

### หลักการออกแบบ

- **Domain Layer** — Business logic ล้วนๆ ไม่ผูกกับ TCP/HTTP/File/Database
- **Ports** — Interface ที่ Domain ใช้สื่อสาร (IAccountStore, IPersistence, INotifier)
- **Adapters** — Implementation จริงของ Ports (InMemory, File, Telegram)
- **Use Cases** — Orchestrate Domain Services ตาม workflow (AuthenticateEA, ProcessSignal)
- **Composition Root** — จุดเดียวที่ wire ทุก dependency (server/index.ts)

---

## 📁 โครงสร้างไฟล์ (File Structure)

```
CopyTrade/
│
├── Server/dashboard/                   ← Unified Project (Frontend + Backend)
│   ├── server/                         ← 🏗 Backend (Clean Architecture)
│   │   ├── index.ts                   ← Composition Root (DI Wiring)
│   │   ├── domain/
│   │   │   ├── entities/              ← Account, Signal, Performance
│   │   │   ├── ports/                 ← IAccountStore, ISignalStore, IPersistence, INotifier, IBroadcaster
│   │   │   └── services/             ← PerformanceTracker, SignalRouter, SyncChecker, RiskCalculator, EquityTracker
│   │   ├── application/               ← AuthenticateEA, ProcessHeartbeat, ProcessSignal, GetDashboardData, ResetPerformance
│   │   ├── adapters/
│   │   │   ├── inbound/              ← TcpAdapter, HttpAdapter, WebSocketAdapter
│   │   │   └── outbound/             ← InMemoryAccountStore, FileStorageAdapter, TelegramAdapter, DashboardBroadcaster
│   │   └── infrastructure/            ← config.ts, scheduler.ts
│   │
│   ├── src/                            ← 🎨 Frontend (React 19 + Vite)
│   │   ├── App.tsx                    ← Dashboard Component
│   │   ├── index.css                  ← Design System (Glassmorphism)
│   │   └── main.tsx                   ← React Entry Point
│   │
│   ├── package.json                    ← Unified Dependencies
│   ├── tsconfig.json                   ← Project References
│   ├── tsconfig.server.json            ← Server TypeScript Config
│   ├── tsconfig.app.json               ← Frontend TypeScript Config
│   └── vite.config.ts                  ← Vite + Proxy Config
│
├── MQL5/                               ← MT5 Expert Advisors
│   ├── Experts/CopyTrade/
│   │   ├── CopyTradeMaster.mq5       ← EA ฝั่ง Master
│   │   └── CopyTradeSlave.mq5        ← EA ฝั่ง Slave
│   └── Include/CopyTrade/
│       ├── TradeExecutor.mqh          ← Engine ยิงออเดอร์ + Price Matching
│       ├── SymbolMapper.mqh           ← Fuzzy Deep Scan จับคู่ Symbol
│       ├── SocketTransport.mqh        ← Remote TCP Transport
│       ├── HttpTransport.mqh          ← Cloud HTTP Transport
│       └── ...                        ← อื่นๆ
│
├── Config/
│   ├── config.json                     ← Non-sensitive defaults
│   └── SymbolMap.txt                   ← Manual Symbol Mapping
│
├── render.yaml                         ← ★ Render.com one-click deploy
├── USER_MANUAL.md                      ← 📘 คู่มือการติดตั้งและใช้งาน CopyTrade Pro v3.0.4 (ฉบับมือใหม่จับมือทำ)
└── README.md                           ← ไฟล์นี้
```

---

## 📋 ความต้องการของระบบ (System Requirements)

### 🖥️ VPS สำหรับ Relay Server

| รายการ | ขั้นต่ำ | แนะนำ |
|---|---|---|
| **OS** | Ubuntu 20.04 LTS / Windows Server 2019 | Ubuntu 22.04 LTS |
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 512 MB | 1 GB |
| **Node.js** | v18.x LTS ขึ้นไป | v20.x LTS |
| **Port ที่ต้องเปิด** | TCP `5555` (Relay), TCP `8080` (Dashboard) | Whitelist IP |

### 🖥️ VPS สำหรับ MetaTrader 5

| รายการ | ขั้นต่ำ | แนะนำ |
|---|---|---|
| **OS** | Windows Server 2019 | Windows Server 2022 |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 2 GB | 4-8 GB |
| **MT5** | Build 3800+ | Build ล่าสุด |

---

## 🚀 วิธีติดตั้งและรัน

### 📦 ขั้นตอนที่ 1: ติดตั้ง Dependencies

```bash
# เข้าไปที่โฟลเดอร์ Server/dashboard
cd Server/dashboard

# ติดตั้ง dependencies ทั้ง frontend + backend
npm install
```

### ▶️ ขั้นตอนที่ 2: รัน Server (Development)

```bash
# รัน server (TypeScript direct execution via tsx)
npm run dev:server

# (Terminal อีกอัน) รัน frontend dev server
npm run dev
```

### 🏭 ขั้นตอนที่ 3: รัน Production

```bash
# Build React Dashboard
npm run build

# Start Server (production)
npm start
```

### ⚙️ ขั้นตอนที่ 4: Environment Variables

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `TCP_PORT` | `5555` | พอร์ตสำหรับรับ-ส่ง Signal (Master/Slave) |
| `HTTP_PORT` | `8080` | พอร์ตสำหรับ Web Dashboard + API |
| `AUTH_TOKEN` | *(ว่าง)* | **สำคัญ!** Token สำหรับยืนยันตัวตน |
| `DASHBOARD_PASSCODE` | *(ว่าง)* | รหัสผ่านเข้า Dashboard |
| `HTTP_ONLY` | `false` | ตั้ง `true` เพื่อเปิดเฉพาะ HTTP |
| `TELEGRAM_BOT_TOKEN` | *(ว่าง)* | Telegram Bot Token |
| `TELEGRAM_CHAT_ID` | *(ว่าง)* | Telegram Chat ID |
| `BROKER_TIMEZONE` | `Europe/Athens` | Timezone ของ Broker |

```bash
# Linux
AUTH_TOKEN=my-secret npm start

# Windows
set AUTH_TOKEN=my-secret && npm start
```

### ⚙️ รันเป็น Background Service

**Linux (systemd):**
```ini
[Unit]
Description=CopyTrade Relay Server v3.0
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/copytrade/Server/dashboard
ExecStart=/usr/bin/npx tsx server/index.ts
Restart=always
RestartSec=5
Environment=TCP_PORT=5555
Environment=HTTP_PORT=8080

[Install]
WantedBy=multi-user.target
```

```powershell
nssm install CopyTradeRelay "C:\Program Files\nodejs\npx.cmd" "tsx server/index.ts"
nssm set CopyTradeRelay AppDirectory "D:\CopyTrade\Server\dashboard"
nssm set CopyTradeRelay DisplayName "CopyTrade Relay Server v3.0"
nssm start CopyTradeRelay
```

---

## 🧹 การล้างไฟล์เวอร์ชันเก่า (v1/v2 -> v3)

โครงสร้างเดิมจะถูกรวมเข้าสู่หมวด **Clean Architecture** ใน `Server/dashboard` ทั้งหมด หากคุณเคยใช้งานเวอร์ชันก่อนหน้า ให้รันคำสั่งเหล่านี้เพื่อเคลียร์ไฟล์ที่ไม่ได้ใช้:

**Windows PowerShell:**
```powershell
Remove-Item -Recurse -Force server.js, modules, src, public, package.json, package-lock.json, start-server.bat, tsconfig.json, tsconfig.node.json, vite.config.ts, tailwind.config.js, postcss.config.js, index.html, auto-commit.js -ErrorAction SilentlyContinue
```

**Linux / Mac:**
```bash
rm -rf server.js modules src public package.json package-lock.json start-server.bat tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.js postcss.config.js index.html auto-commit.js
```

---

## ☁️ Deploy ฟรีบน Cloud

### Render.com (แนะนำ — ง่ายที่สุด)

```
1. Fork/Push repo ไปที่ GitHub
2. ไปที่ https://dashboard.render.com
3. กด "New +" → "Blueprint" → เลือก repo
4. Render จะอ่าน render.yaml อัตโนมัติ
5. ใส่ค่า Environment Variables (AUTH_TOKEN, DASHBOARD_PASSCODE)
6. กด Deploy!
```

> URL จะได้แบบ `https://your-app-name.onrender.com`

### ตั้งค่า EA สำหรับ Cloud Deploy

**Master EA:**
| Parameter | ค่า |
|---|---|
| Copy Mode | `HTTP (Cloud/Serverless)` |
| Relay Server IP | `https://your-app-name.onrender.com` |
| Auth Token | Token ที่ตั้งไว้ใน ENV |

**Slave EA:**
| Parameter | ค่า |
|---|---|
| Copy Mode | `HTTP (Cloud/Serverless)` |
| Relay Server IP | `https://your-app-name.onrender.com` |
| Auth Token | Token ที่ตั้งไว้ใน ENV |

---

## 🖧 โครงสร้าง Network

```
      Remote Mode — TCP (VPS / Local):
                ┌─────────────────┐
                │  📊 Dashboard   │
                │  React 19       │
                │  Port 8080 WS   │
                └────────┬────────┘
                         │ WebSocket
                         ▼
┌──────────┐    ┌───────────────────┐    ┌──────────┐
│ 👑 Master│───▶│  🔁 Relay Server  │───▶│ 📋 Slave │
│  MT5 EA  │TCP │  TypeScript (tsx) │TCP │  MT5 EA  │
│  VPS-A   │5555│  VPS / Cloud      │5555│  VPS-B   │
└──────────┘    └───────────────────┘    └──────────┘

      Cloud Mode — HTTP (Render.com):
┌──────────┐    ┌───────────────────┐    ┌──────────┐
│ 👑 Master│───▶│  ☁️ Cloud Server  │◀───│ 📋 Slave │
│  MT5 EA  │POST│  Render.com       │POLL│  MT5 EA  │
│  VPS-A   │HTTP│  (Free Hosting)   │HTTP│  VPS-B   │
└──────────┘    └───────────────────┘    └──────────┘
```

---

## ⚡ โหมดจับราคา (Execution Modes)

| Mode | การทำงาน | แนะนำสำหรับ |
|---|---|---|
| `EXEC_MARKET` | ใช้ราคาตลาดปัจจุบัน | ข้าม Broker ราคาต่างกันมาก |
| **`EXEC_MATCH_MASTER`** ⭐ | ราคาที่ Master fill จริง + 3-tier deviation | **แนะนำ! ทุกกรณี** |
| `EXEC_LIMIT_CHASE` | วาง Limit Order → รอ 3 วิ → fallback market | ตลาดช้า |

## ⚙️ โหมดคำนวณ Lot

| Mode | การคำนวณ | ตัวอย่าง |
|---|---|---|
| `LOT_EXACT` | ล็อตเท่า Master 100% | Master 0.1 / Slave 0.1 |
| `LOT_RATIO` | คูณตัวคูณ | Master 0.1 (2x) / Slave 0.2 |
| `LOT_FIXED` | ล็อตคงที่ | Master 10.0 / Slave ตามที่ตั้ง |
| `LOT_BALANCE` | % จากพอร์ต | ตามอัตราส่วนเงินทุน |

---

## 🛡️ Checklist ก่อน Go Live

- [ ] **AUTH_TOKEN** — ตั้งค่า token
- [ ] **Relay Server** — รันเป็น Service หรือ deploy บน Cloud
- [ ] **Firewall** — เปิด Port 5555 + 8080 ให้เฉพาะ IP ที่ต้องการ
- [ ] **Dashboard** — ตั้ง `DASHBOARD_PASSCODE`
- [ ] **MT5 Settings** — เปิด `Allow Algo Trading` + `Allow DLL Imports`
- [ ] **MT5 WebRequest** — ถ้าใช้ HTTP mode: เพิ่ม URL server
- [ ] **Node.js** — ใช้ LTS (18.x / 20.x)
- [ ] **ทดสอบ** — Demo Account ก่อน Real เสมอ
- [ ] **Execution Mode** — แนะนำ `EXEC_MATCH_MASTER`

---

## 🔄 Changelog

ดูรายละเอียดทั้งหมดได้ที่ [CHANGELOG.md](CHANGELOG.md)

| Version | วันที่ | สรุป |
|---|---|---|
| **v3.0.4** | 2026-04-11 | **Institutional HUD Architecture**: Overhaul UI/UX สไตล์ HUD, รองรับ PWA (Install App) |
| **v3.0.3** | 2026-04-11 | Prop Firm Analytics, Live Neural Relay, Stability Fixes |
| **v3.0** | 2026-04-11 | Clean Architecture (Hexagonal), TypeScript ทั้งระบบ, Unified Project |

---

*CopyTrade System v3.0 — Clean Architecture, TypeScript, Institutional-Grade Execution Engine*
