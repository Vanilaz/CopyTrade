# CopyTrade MT5 — ระบบ Copy Trade ข้ามเครื่อง ข้าม Broker (Institutional Grade)

> **Version 2.0** — Cloud Deploy + Security Hardening  
> รองรับ Deploy บน Free Hosting (Render/Vercel), HTTP Transport สำหรับ Cloud, Security Audit ครบ

---

## 🎯 ความสามารถหลัก

| Feature | รายละเอียด |
|---|---|
| ✅ **Fuzzy Deep Scan** | จับคู่ชื่อ Symbol ข้าม Broker อัตโนมัติ (เช่น XAUUSD -> XAUUSD.std) โบรกเกอร์ชื่อแปลกแค่ไหนก็หากันเจอ |
| ✅ **Local Copy** | Copy ในเครื่องเดียวกัน / VPS เดียวกัน ผ่าน Shared Files (เร็ว <10ms) |
| ✅ **Remote Copy** | Copy ข้าม VPS หรือคนละประเทศผ่าน TCP Socket + Relay Server (Node.js) |
| ✅ **Price Matching** | จับราคา fill จริงของ Master แล้วส่งให้ Slave ยิงตามราคาเดิมด้วย deviation 30 pt (ปรับได้) |
| ✅ **Auto Account ID** | ผูกระบบด้วยเลขบัญชีเข้าเทรด Master ทันที ไม่ต้องกรอก Token ให้ยุ่งยาก |
| ✅ **Exact Match SL/TP**| คำนวณความห่างของ SL/TP จาก Master แล้วแปลงเป็นระยะ Point ให้ Slave เป๊ะๆ |
| ✅ **Pending Orders** | รองรับไม้ Pending ทุกประเภท (Buy Limit, Sell Stop, etc.) |
| ✅ **Auto-Reconnect** | หากเน็ตหลุด / เซิร์ฟเวอร์รีสตาร์ท EA จะเชื่อมต่อกลับเองแบบอัตโนมัติ |
| ✅ **Safety Net** | ตรวจจับ Position ที่หลุดจาก OnTradeTransaction อัตโนมัติ — ไม่มีสัญญาณตกหล่น |
| ✅ **Smart Sync** | เลือกได้ว่าจะ sync position เดิมที่เปิดอยู่ก่อน EA หรือ copy เฉพาะไม้ใหม่ (InpSyncExisting) |
| ✅ **Filling Mode Auto-Detect** | ตรวจจับ Filling Policy (IOC/FOK/RETURN) ของ Broker อัตโนมัติ ไม่ต้องตั้งค่าเอง |
| ✅ **Bento Dashboard** | แจ้งเตือนสถานะบัญชีแบบสดๆ (Live) ด้วยหน้าต่างบัญชาการสไตล์ Bento Box |
| ✅ **Cloud Deploy** | Deploy ฟรีบน Render.com / Vercel — ไม่ต้องเช่า VPS แยก สำหรับ Relay Server |
| ✅ **HTTP Transport** | รองรับ WebRequest สำหรับ Cloud/Serverless — ไม่ต้องเปิด TCP Port |
| ✅ **Auth Token** | ป้องกัน Unauthorized Access ด้วย Token ทั้ง TCP และ HTTP |

---

## 📋 ความต้องการของระบบ (System Requirements)

### 🖥️ VPS สำหรับ Relay Server (Node.js)

| รายการ | ขั้นต่ำ | แนะนำ |
|---|---|---|
| **OS** | Ubuntu 20.04 LTS / Windows Server 2019 | Ubuntu 22.04 LTS (เบากว่า, เสถียรกว่า) |
| **CPU** | 1 vCPU | 2 vCPU |
| **RAM** | 512 MB | 1 GB |
| **Disk** | 5 GB SSD | 10 GB SSD |
| **Network** | 100 Mbps, Static IP | 1 Gbps, Static IP, Low Latency |
| **Node.js** | v18.x LTS ขึ้นไป | v20.x LTS |
| **Port ที่ต้องเปิด** | TCP `5555` (Relay), TCP `8080` (Dashboard) | เปิดเฉพาะ IP ที่ต้องการ (Whitelist) |

> 💡 **Relay Server เบามาก** — ใช้ RAM ไม่ถึง 50 MB ตอนรันจริง VPS ราคา $3-5/เดือน ใช้ได้สบาย

### 🖥️ VPS สำหรับ MetaTrader 5 (Master/Slave EA)

| รายการ | ขั้นต่ำ (1 MT5) | แนะนำ (หลาย MT5 พร้อมกัน) |
|---|---|---|
| **OS** | Windows Server 2019 / Windows 10 | Windows Server 2022 |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 2 GB | 4-8 GB (ต่อ MT5 Terminal ใช้ ~500MB-1GB) |
| **Disk** | 30 GB SSD | 60 GB SSD |
| **Network** | 100 Mbps, ต่ำ Latency | 1 Gbps, ใกล้ศูนย์ข้อมูล Broker |
| **MT5** | Build 3800+ | Build ล่าสุด |
| **สิทธิ์ EA** | เปิด `Allow Algo Trading` + `Allow DLL` | — |

> ⚠️ **สำคัญ:** MT5 ต้องรันบน Windows เท่านั้น (รองรับ Wine บน Linux แต่ไม่แนะนำสำหรับ Production)

---

## 🌐 Port & Firewall ที่ต้องเปิด

| Port | Protocol | ใช้ทำอะไร | เปิดที่ไหน |
|---|---|---|---|
| `5555` | TCP | Relay Server — รับ/ส่ง Trade Signal | VPS ที่รัน Relay Server |
| `8080` | TCP | Web Dashboard (HTTP + WebSocket) | VPS ที่รัน Relay Server |

### วิธีเปิด Firewall

**Windows Server:**
```powershell
# เปิด Port 5555 (Trade Signals)
netsh advfirewall firewall add rule name="CopyTrade Relay" dir=in action=allow protocol=TCP localport=5555

# เปิด Port 8080 (Web Dashboard) — เฉพาะ IP ที่ต้องการเข้าดู
netsh advfirewall firewall add rule name="CopyTrade Dashboard" dir=in action=allow protocol=TCP localport=8080
```

**Ubuntu/Linux:**
```bash
sudo ufw allow 5555/tcp comment "CopyTrade Relay"
sudo ufw allow 8080/tcp comment "CopyTrade Dashboard"
sudo ufw reload
```

> 🔒 **Security Tip:** สำหรับ Dashboard Port 8080 ควรจำกัดให้เข้าถึงได้เฉพาะ IP ของคุณ:
> ```bash
> # Linux — อนุญาตเฉพาะ IP 203.x.x.x
> sudo ufw allow from 203.x.x.x to any port 8080 proto tcp
> ```

---

## 🚀 วิธีติดตั้งและรันบน Production VPS

### 📦 ขั้นตอนที่ 1: ติดตั้ง Relay Server

**บน Ubuntu VPS:**
```bash
# 1. ติดตั้ง Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. คัดลอกโฟลเดอร์ Server ขึ้น VPS (ใช้ SCP/SFTP)
scp -r ./Server/ user@YOUR_VPS_IP:/opt/copytrade/

# 3. ติดตั้ง Dependencies
cd /opt/copytrade/Server
npm install --production

# 4. ทดสอบรัน
node server.js
```

**บน Windows VPS:**
```powershell
# 1. ติดตั้ง Node.js จาก https://nodejs.org (เลือก LTS)
# 2. เปิด Command Prompt
cd C:\CopyTrade\Server
npm install --production
node server.js
```

### ⚙️ ขั้นตอนที่ 2: รันเป็น Background Service (แนะนำ)

เพื่อให้ Relay Server ทำงานตลอดเวลาแม้ปิดหน้าจอ:

**Linux (systemd):**
```bash
sudo nano /etc/systemd/system/copytrade.service
```
ใส่เนื้อหา:
```ini
[Unit]
Description=CopyTrade Relay Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/copytrade/Server
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=TCP_PORT=5555
Environment=HTTP_PORT=8080

[Install]
WantedBy=multi-user.target
```
จากนั้น:
```bash
sudo systemctl daemon-reload
sudo systemctl enable copytrade
sudo systemctl start copytrade

# ดู Log
sudo journalctl -u copytrade -f
```

**Windows (NSSM — Non-Sucking Service Manager):**
```powershell
# ดาวน์โหลด NSSM จาก https://nssm.cc/download
nssm install CopyTradeRelay "C:\Program Files\nodejs\node.exe" "C:\CopyTrade\Server\server.js"
nssm set CopyTradeRelay AppDirectory "C:\CopyTrade\Server"
nssm set CopyTradeRelay DisplayName "CopyTrade Relay Server"
nssm set CopyTradeRelay Start SERVICE_AUTO_START
nssm start CopyTradeRelay
```

### 🔧 ขั้นตอนที่ 3: Environment Variables (ปรับแต่งเพิ่มเติม)

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `TCP_PORT` | `5555` | พอร์ตสำหรับรับ-ส่ง Signal (Master/Slave) |
| `HTTP_PORT` | `8080` | พอร์ตสำหรับ Web Dashboard + WebSocket |
| `AUTH_TOKEN` | *(ว่าง)* | **สำคัญ!** Token สำหรับยืนยันตัวตน — ต้องตั้งค่า |
| `DASHBOARD_PASSCODE` | *(ว่าง)* | รหัสผ่านเข้า Dashboard |
| `HTTP_ONLY` | `false` | ตั้ง `true` เพื่อเปิดเฉพาะ HTTP (ไม่มี TCP) |
| `TELEGRAM_BOT_TOKEN` | *(ว่าง)* | Telegram Bot Token สำหรับแจ้งเตือน |
| `TELEGRAM_CHAT_ID` | *(ว่าง)* | Telegram Chat ID |
| `BROKER_TIMEZONE` | `Europe/Athens` | Timezone ของ Broker (EET/EEST) |

ตั้งค่าผ่าน Environment:
```bash
# Linux
AUTH_TOKEN=my-secret TCP_PORT=5555 HTTP_PORT=8080 node server.js

# Windows
set AUTH_TOKEN=my-secret && set TCP_PORT=5555 && set HTTP_PORT=8080 && node server.js
```

---

## ☁️ Deploy ฟรีบน Cloud (ไม่ต้องเช่า VPS)

### วิธีที่ 1: Render.com (แนะนำ — ง่ายที่สุด, ฟรี)

Render.com รองรับ TCP + HTTP, Auto-deploy จาก GitHub, ฟรี 750 ชม./เดือน

```
1. Fork/Push repo ไปที่ GitHub
2. ไปที่ https://dashboard.render.com
3. กด "New +" → "Blueprint" → เลือก repo
4. Render จะอ่าน render.yaml อัตโนมัติ
5. ใส่ค่า Environment Variables (AUTH_TOKEN, DASHBOARD_PASSCODE)
6. กด Deploy!
```

หรือ Manual:
```
1. กด "New +" → "Web Service"
2. เลือก repo, Branch: main
3. Build Command: cd Server && npm ci --production
4. Start Command: cd Server && node server.js
5. ตั้ง Environment Variables
6. Deploy
```

> URL จะได้แบบ `https://your-app-name.onrender.com`

### วิธีที่ 2: Vercel (Serverless — HTTP Only)

> ⚠️ Vercel เป็น Serverless ไม่รองรับ TCP — EA ต้องใช้โหมด `COPY_HTTP`

```
1. Fork/Push repo ไปที่ GitHub
2. ไปที่ https://vercel.com → Import Project
3. Root Directory: Server
4. ตั้ง Environment Variables: AUTH_TOKEN, DASHBOARD_PASSCODE, HTTP_ONLY=true
5. Deploy
```

### ตั้งค่า EA สำหรับ Cloud Deploy

เมื่อ deploy บน Cloud แล้ว ตั้งค่า EA ดังนี้:

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

> ⚠️ **สำคัญ:** ต้องเพิ่ม URL ใน MT5: `Tools → Options → Expert Advisors → Allow WebRequest for listed URL` แล้วใส่ URL ของ server

---

## 🖧 โครงสร้าง Network (Architecture)

```
      Remote Mode — TCP (VPS / Local):
                ┌─────────────────┐
                │  📊 Dashboard   │
                │  (Browser)      │
                │  Port 8080 WS   │
                └────────┬────────┘
                         │ WebSocket
                         ▼
┌──────────┐    ┌───────────────────┐    ┌──────────┐
│ 👑 Master│───▶│  🔁 Relay Server  │───▶│ 📋 Slave │
│  MT5 EA  │TCP │  Node.js          │TCP │  MT5 EA  │
│  VPS-A   │5555│  VPS / Cloud      │5555│  VPS-B   │
└──────────┘    └───────────────────┘    └──────────┘

      Cloud Mode — HTTP (Render / Vercel):
┌──────────┐    ┌───────────────────┐    ┌──────────┐
│ 👑 Master│───▶│  ☁️ Cloud Server  │◀───│ 📋 Slave │
│  MT5 EA  │POST│  Render / Vercel  │POLL│  MT5 EA  │
│  VPS-A   │HTTP│  (Free Hosting)   │HTTP│  VPS-B   │
└──────────┘    └───────────────────┘    └──────────┘

      Local Mode (เครื่องเดียวกัน):
┌──────────┐    ┌───────────────────┐    ┌──────────┐
│ 👑 Master│───▶│  📂 Common Files  │───▶│ 📋 Slave │
│  MT5 EA  │    │  (FILE_COMMON)    │    │  MT5 EA  │
│  Chart 1 │    │  copytrade/*.json │    │  Chart 2 │
└──────────┘    └───────────────────┘    └──────────┘
```

- **Master EA** → เทรดปกติ → จับ deal → ส่ง signal (File / TCP / HTTP)
- **Local Mode** → Master เขียนไฟล์ไปยัง `Common Files\copytrade\` → Slave อ่านทุก 50ms
- **Remote TCP** → Relay Server → รับ signal → push ไปยัง Slave ทุกตัว (เร็วที่สุด)
- **Cloud HTTP** → Master POST signal → Slave poll ทุก 1-2 วินาที (deploy ฟรี)
- **Slave EA** → รับ signal → เปิดออเดอร์ตาม Master (รองรับ Price Matching)
- **Dashboard** → เชื่อมต่อผ่าน WebSocket/SSE → แสดงผลแบบ Real-time

---

## 🚀 วิธีตั้งค่าใช้งาน Local Mode (เครื่องเดียวกัน)

### ตั้งค่า Master EA
1. เปิด MT5 กราฟใดก็ได้ ลาก `CopyTradeMaster` ไปใส่
2. หน้า Input ตั้งค่า:
   - `Copy Mode` = `Local via Files`
3. สังเกตที่ Experts Tab จะต้องขึ้น `📁 File Transport: Ready`

### ตั้งค่า Slave EA
1. เปิดกราฟอีกอัน (Terminal เดียวกัน หรือต่าง Terminal ก็ได้) ลาก `CopyTradeSlave` ไปใส่
2. หน้า Input ตั้งค่า:
   - `Copy Mode` = `Local via Files`
   - `Master Account ID` = **เลขบัญชี Master** (เช่น `58022696`)
3. สังเกตที่ Experts Tab จะต้องขึ้น `✅ Slave EA initialized`

> 📁 **หมายเหตุ:** ไฟล์ Signal ถูกเก็บไว้ที่  
> `C:\Users\<User>\AppData\Roaming\MetaQuotes\Terminal\Common\Files\copytrade\`  
> ทุก MT5 Terminal บนเครื่องเดียวกันเข้าถึง folder นี้ได้โดยอัตโนมัติ

---

## 🚀 วิธีตั้งค่าใช้งานข้ามเครื่อง (Remote Mode)

หากคุณนำ Master ไปไว้ที่ VPS-A และ Slave ไว้ที่ VPS-B คุณจำเป็นต้องมี **Relay Server (ตัวกลางส่งสัญญาณ)** 
โดยสามารถรัน Relay Server ไว้ที่ VPS-A (เครื่อง Master) หรือจะเช่า VPS-C (Ubuntu/Windows) แยกรันเซิร์ฟเวอร์เพียวๆ เลยก็ได้ครับ

### ตั้งค่า Master EA (บน VPS-A)
1. เปิด MT5 กราฟใดก็ได้ ลาก `CopyTradeMaster` ไปใส่
2. หน้า Input ตั้งค่า:
   - `Copy Mode` = `Remote via Server`
   - `Relay Host` = `127.0.0.1` *(เพราะรันเซิร์ฟเวอร์ตัวกลางไว้ในเครื่องตัวเอง)*
   - `Relay Port` = `5555`
3. สังเกตที่หน้าต่าง Experts จะต้องขึ้นคำว่า `✅ Connected to Relay Server`

### ตั้งค่า Slave EA (บน VPS-B)
1. เปิด MT5 ที่เครื่อง **VPS-B** เลือกกราฟมา 1 อันเพื่อแนบ `CopyTradeSlave`
2. หน้า Input ตั้งค่า:
   - `Copy Mode` = `Remote via Server`
   - `Relay Host` = **ไอพีของ VPS-A** *(เช่น `103.45.67.89`)*
   - `Relay Port` = `5555`
   - `Master Account ID` = **ระบุเลขพอร์ตของบัญชี Master ให้ถูกต้อง!** (เช่น `58022696`)
3. **การอนุญาต WebRequest:** 
   - ไปที่ Tools -> Options -> Expert Advisors
   - ติ๊กถูกที่ `Allow WebRequest for listed URL:`
   - เพิ่ม IP ของเป้าหมายลงไปในกล่อง (เช่น `https://103.45.67.89` และ `http://103.45.67.89`)
4. กด OK สังเกตที่หน้าต่าง Experts จะต้องขึ้นข้อความ `✅ Connected to Relay` และ `✅ Slave EA initialized`

---

## ⚡ โหมดจับราคา (Execution Modes)

| Mode | การทำงาน | แนะนำสำหรับ |
|---|---|---|
| `EXEC_MARKET` | ใช้ราคาตลาดปัจจุบัน (แบบเดิม) | ข้าม Broker ที่ราคาต่างกันมาก |
| **`EXEC_MATCH_MASTER`** ⭐ | ส่งราคาที่ Master fill จริง + 3-tier deviation (30pt default) | **แนะนำ! ใช้ได้ทั้ง Broker เดียวกัน & ข้าม Broker** |
| `EXEC_LIMIT_CHASE` | วาง Limit Order ที่ราคา Master → รอ 3 วิ → ถ้าไม่ fill ก็ market | ตลาดช้า, ต้องการราคาแม่นยำ |

---

## ⚙️ โหมดคำนวณ Lot (Lot Types)

| Mode | การคำนวณ | ตัวอย่าง |
|---|---|---|
| `LOT_EXACT` | ยิงล็อตเท่า Master เป๊ะ 100% | Master ออก 0.1 / Slave ออก 0.1 |
| `LOT_RATIO` | คูณจำนวนเท่า (ตัวคูณ) | Master ออก 0.1 (สัดส่วน 2.0x) / Slave ออก 0.2 |
| `LOT_FIXED` | ใช้ล็อตคงที่ ล็อคตายตัว | Master ออก 10.0 / Slave ก็ยังจะออกตามล็อตที่คุณกรอก |
| `LOT_BALANCE` | คุมความเสี่ยง % จากพอร์ต | ยิงตามความเสี่ยงเทียบระหว่าง Master กับ Slave |

---

## 📝 กลไกการรับมือกับรายชื่อเหรียญที่ต่างกัน (Cross-Broker Suffix Collision)

ไม่ต้องกังวลว่าบัญชี Master ส่งมาเป็น `XAUUSD.r` และ Slave ของคุณเป็นบัญชี Cent ที่มีชื่อเหรียญว่า `XAUUSD.std` 
ระบบ CopyTrade Pro ได้รับการอัปเกรดเพื่อจัดการปัญหานามสกุลบัญชีไม่ตรงกัน (Suffix Collision) แบบเหนือชั้นด้วย **กลไกการสแกน 3 ชั้น (3-Layer Defense)**:

1. **Base Symbol Extractor:** ระบบจะดักจับนามสกุลส่วนเกิน (เช่น `.r`, `-ECN`, `_std`, `c`) โดยหั่นทิ้งด้วยจุด (.) หรือขีด (-) จนเหลือแค่ Base Symbol เพียวๆ (เช่น เปลี่ยน `XAUUSD.r` ให้เหลือแค่ `XAUUSD`)
2. **Fuzzy Deep Scan:** นำ Base Symbol ที่ถูกสกัดมาแล้ว ไปสแกนหาใน Market Watch ของโบรคเกอร์ปลายทาง หากพบว่าสอดคล้องกัน (เช่น เจอ `XAUUSD.std`) ระบบจะทำการจัดคู่ (Mapping) ให้เองแบบ **อัตโนมัติ 100%** ไร้รอยต่อข้าม Broker
3. **Manual Override:** กรณีที่โบรกเกอร์ 2 แห่งใช้คำศัพท์คนละโลก เช่น Master เป็น `XAUUSD` แต่ Slave เป็น `GOLD` คุณสามารถกรอกจับคู่เองได้ง่ายๆ ผ่านหน้า Setting (หรือ `Config/SymbolMap.txt`) ระบบจะให้ความสำคัญกับคำสั่งของคุณเป็นอันดับ 1

---

## 🛡️ กลไกความน่าเชื่อถือ (Reliability Mechanisms)

### Signal Delivery — ชั้นป้องกัน 3 ระดับ

```
ชั้นที่ 1: OnTradeTransaction → HistoryDealSelect (retry 20 ครั้ง, ทุก 5ms)
  ├─ สำเร็จ → ส่ง Signal ทันที ✅
  └─ ล้มเหลว → ตกไปชั้นที่ 2

ชั้นที่ 2: Safety Net (OnTimer ทุก 50ms)
  ├─ สแกน Positions ทั้งหมด
  ├─ เจอ Position ที่ยังไม่เคยส่ง Signal → ส่งทันที ✅
  └─ ไม่มีตกหล่น

ชั้นที่ 3: Smart Sync on Startup
  ├─ InpSyncExisting = false (default): ข้ามไม้เก่า → copy เฉพาะ trade ใหม่
  └─ InpSyncExisting = true: sync ทุก position ให้ Slave (restart recovery)
```

### Filling Mode Auto-Detect

ระบบตรวจจับ Filling Policy ที่ Broker รองรับโดยอัตโนมัติ:

| ลำดับ | Filling Mode | Broker ที่ใช้ |
|---|---|---|
| 1 | `ORDER_FILLING_IOC` | ส่วนใหญ่ (ECN, STP) |
| 2 | `ORDER_FILLING_FOK` | Dealing Desk, Fixed Spread |
| 3 | `ORDER_FILLING_RETURN` | บาง Broker เก่า |

### Signal ID — ไม่ซ้ำเด็ดขาด

ใช้ Atomic Counter (เริ่มจาก System Uptime + เพิ่มทีละ 1) เพื่อป้องกัน Filename Collision เมื่อส่งหลาย Signal พร้อมกัน

### Deduplication — Set-Based

Slave ใช้ Set-based dedup (เก็บ 500 signalID ล่าสุด) แทน Sequential ID ซึ่งรับประกันว่าทุก Signal จะถูกประมวลผลไม่ว่า File System จะคืนไฟล์ลำดับใดก็ตาม

---

## 📊 Institutional Web Dashboard (Bento UI)

ระบบมาพร้อมกับหน้าจอสั่งการ (Command Center) สไตล์ Bento Box สุดพรีเมียม (Dark Mode) สำหรับช่วยให้คุณมอนิเตอร์สถานะพอร์ตการลงทุนทั้งหมดได้จากที่เดียวผ่านเบราว์เซอร์:

- **Real-time Financial Telemetry:** มีระบบถ่ายทอดสดสถานะทางการเงินของแต่ละพอร์ตทุกวินาที
- **Total Floating PnL Tracker:** ดูยอดกำไร/ขาดทุนรวม (PnL) ที่กำลังวิ่งอยู่ (Floating) ของระบบทั้งหมดแบบสดๆ แบบเลขใหญ่เบิ้ม
- **Active Accounts Watcher:** แสดงกล่องสถานะ (Card) ของ Master และ Slave แต่ละบัญชี โดยจะบอกข้อมูลเจาะลึก:
  - **Margin Level (%):** ติดตามระดับมาร์จิ้น หากลงต่ำจะแสดงไฟเตือนสีส้มเรืองแสงทันที
  - **Equity & Balance:** สรุปยอดเงินทุนและทุนสุทธิ
  - **Active Positions:** แจ้งเตือนว่าบัญชีไหนถือออเดอร์ค้างไว้กี่ออเดอร์
  - **Account PnL:** หากพอร์ตนั้นบวกอยู่ ตัวเลขจะเป็นสีเขียว/น้ำเงินเรืองแสง หากติดลบจะเป็นสีแดงเรืองแสง
- **Execution Log Flow:** ดูกล่องข้อความ (Logs) การยิงคำสั่ง, การประมวลผลอัลกอริทึม, และการแจ้งเตือน Error บนเว็บได้เลย ไม่ต้องเข้า VPS ไปเปิด MT5 ดูเองทีละจอ

วิธีเข้าดู: แค่เปิดเบราว์เซอร์เข้าไปที่ `http://<IP-เครื่อง-VPS>:8080/` (หรือ `http://localhost:8080/` ถ้าเปิดในเครื่องตัวเอง)

---

## 📁 โครงสร้างไฟล์ (File Structure)

```
CopyTrade/
│
├── Server/                           ← Relay Server v2.0 (Node.js)
│   ├── server.js                     ← Dual-Mode: TCP + HTTP Transport
│   ├── package.json                  ← Dependencies (ws)
│   ├── .env.example                  ← Template ค่า Environment Variables
│   ├── Dockerfile                    ← Container deployment
│   ├── vercel.json                   ← Vercel serverless config
│   └── public/
│       └── dashboard.html            ← Web Dashboard UI
│
├── MQL5/
│   ├── Experts/CopyTrade/
│   │   ├── CopyTradeMaster.mq5      ← EA ฝั่ง Master
│   │   └── CopyTradeSlave.mq5       ← EA ฝั่ง Slave
│   │
│   └── Include/CopyTrade/
│       ├── CopyTradeDefines.mqh      ← Structs, Enums, ค่าคงที่
│       ├── TradeExecutor.mqh         ← Engine สั่งเปิด/ปิดออเดอร์ + Price Matching
│       ├── SymbolMapper.mqh          ← Fuzzy Deep Scan จับคู่ Symbol
│       ├── FileTransport.mqh         ← Local IPC ผ่าน FILE_COMMON
│       ├── SocketTransport.mqh       ← Remote TCP Socket Transport
│       ├── HttpTransport.mqh         ← ★ Cloud HTTP Transport (WebRequest)
│       ├── JsonHelper.mqh            ← Serialize/Deserialize JSON
│       ├── DashboardUI.mqh           ← Dashboard แสดงผลบนจอ MT5
│       └── Logger.mqh                ← ระบบ Log
│
├── Config/
│   ├── config.json                   ← Non-sensitive defaults
│   └── SymbolMap.txt                 ← Manual Symbol Mapping (Override)
│
├── render.yaml                       ← ★ Render.com one-click deploy
└── README.md                         ← ไฟล์นี้
```

---

## 🛡️ Checklist ก่อน Go Live

- [ ] **AUTH_TOKEN** — ตั้งค่า token ที่แข็งแรง (ห้ามใช้ค่าเริ่มต้น!)
- [ ] **Relay Server** — รันเป็น Service (systemd/NSSM) หรือ deploy บน Cloud (Render)
- [ ] **Firewall** — เปิด Port 5555 (TCP) ให้เฉพาะ IP ที่ต้องการ (ถ้าใช้ TCP mode)
- [ ] **Dashboard** — ตั้ง `DASHBOARD_PASSCODE` เพื่อป้องกัน
- [ ] **MT5 Settings** — เปิด `Allow Algo Trading` + `Allow DLL Imports`
- [ ] **MT5 WebRequest** — ถ้าใช้ HTTP mode: เพิ่ม URL server ใน `Allow WebRequest for listed URL`
- [ ] **Node.js Version** — ใช้ LTS เท่านั้น (18.x หรือ 20.x)
- [ ] **ทดสอบ** — เปิด Demo Account ทดสอบก่อนใช้ Real เสมอ
- [ ] **Execution Mode** — แนะนำ `EXEC_MATCH_MASTER` ทั้ง Broker เดียวกัน & ข้าม Broker
- [ ] **SyncExisting** — ถ้ามี position เปิดอยู่ก่อนรัน EA ให้ใช้ค่า default `false`
- [ ] **Monitor** — เปิด Dashboard ดู Signal / สถานะบัญชี ตลอดเวลาในช่วงแรก

---

## 🔄 Changelog

### v2.0 — Cloud Deploy + Security Hardening (2026-04-10)

**☁️ Cloud Deploy (ใหม่!):**
- รองรับ Deploy ฟรีบน **Render.com** (แนะนำ) และ **Vercel** (Serverless)
- เพิ่ม `render.yaml` — กดปุ่มเดียว deploy ทั้ง server
- เพิ่ม `Dockerfile` — รองรับ Container deployment (Railway, Fly.io, etc.)
- เพิ่ม `vercel.json` — Serverless deployment (HTTP-only mode)
- Server รองรับ **HTTP-ONLY mode** (`HTTP_ONLY=true`) สำหรับ Serverless platform
- ใช้ `PORT` environment variable อัตโนมัติ (Render/Vercel กำหนดให้)

**🌐 HTTP Transport (ใหม่!):**
- เพิ่ม `HttpTransport.mqh` — ใช้ `WebRequest()` สื่อสารผ่าน HTTP แทน TCP Socket
- EA API endpoints: `/api/ea/auth`, `/api/ea/heartbeat`, `/api/ea/signal`, `/api/ea/poll`, `/api/ea/subscribe`
- Master ส่ง signal ผ่าน HTTP POST, Slave poll ผ่าน HTTP GET
- เพิ่ม `COPY_HTTP` mode ใน `ENUM_COPY_MODE` — เลือกได้ใน EA input
- เพิ่ม SSE (Server-Sent Events) endpoint สำหรับ Dashboard บน Serverless
- Health check endpoint `/health` สำหรับ monitoring

**🔒 Security Hardening:**
- ลบ hardcoded Telegram token ออก — ใช้ Environment Variables เท่านั้น
- เพิ่ม TCP auth token validation — ตรวจ token ก่อน accept connection
- แก้ Path Traversal vulnerability ใน HTTP static file serving
- เพิ่ม `InpAuthToken` input parameter ใน Master/Slave EA

**⚡ Performance:**
- Throttle dashboard broadcasts สูงสุด 1 ครั้ง/วินาที (เดิมทุก heartbeat)
- Batch history file writes ทุก 5 วินาที (ป้องกัน concurrent write)
- `GetCumulativeDW()` scan แบบ incremental — O(1) ปกติ, O(n) เฉพาะเมื่อมี DW ใหม่
- `NormalizeLot` คำนวณ precision จาก stepLot แบบ dynamic (เดิม hardcode 2 ทศนิยม)

---

### v1.2 — Cross-Broker Precision & Dashboard Overhaul (2026-04-10)

**🔴 แก้ไขบั๊กร้ายแรง (Critical Fixes):**

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

**🟠 แก้ไข Dashboard แสดงข้อมูลผิด:**

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

**🟡 ปรับปรุง Latency (ลด worst-case จาก ~350ms เหลือ ~160ms):**

| จุดที่ปรับ | เดิม | ใหม่ |
|---|---|---|
| HistoryDealSelect retry | 10 ครั้ง x 20ms = 200ms | 20 ครั้ง x 5ms = 100ms |
| CT_POLL_MS (file polling) | 100ms | 50ms |
| SocketRead timeout | 50ms | 10ms |
| Slave Timer interval | 100ms | 50ms |
| TradeExecutor retryDelay | 500ms | 150ms |
| InpMatchSlippage default | 5 points (แน่นเกินสำหรับ Gold) | 30 points |
| InpStalePriceMs | 2000ms | 5000ms (เผื่อ cross-broker) |

**🟢 ปรับปรุงอื่นๆ:**

- **Server (server.js):** เพิ่ม equity history tracking, sync monitor, risk metrics, reset-performance API
- **JsonHelper.mqh:** แก้ positionDetails JSON ที่ comma ผิดตำแหน่ง → `[{...},,{...}]`
- **Telegram Daily Report (server.js):** `'\\n'` (backslash ตัวอักษร) → `'\n'` (ขึ้นบรรทัดใหม่จริง)
- **Dead Code Cleanup:** ลบ `formatPnL` function ที่ไม่ได้ใช้ออกจาก dashboard

---

### v1.1 — Signal Reliability Patch (2026-04-09)

**🔴 Critical Fixes:**
- **Signal ID Collision:** `signalID = GetTickCount64()` ทำให้หลาย signal ได้ชื่อไฟล์เดียวกัน → ไฟล์ทับกัน → signal หาย  
  → แก้เป็น Atomic Counter ที่ unique ทุกตัว
- **HistoryDealSelect Race:** `OnTradeTransaction` อาจ fire ก่อน Deal พร้อมใน History → signal ไม่ถูกส่ง  
  → เพิ่ม retry 10 ครั้ง (ทุก 20ms, สูงสุด 200ms)
- **FILE_COMMON Path Mismatch:** Master เขียน Common Files แต่ Slave ค้นหาใน Local Files  
  → ทั้งคู่ใช้ FILE_COMMON เสมอ
- **Sequential Dedup Bug:** `lastReadSignalID` ข้ามสัญญาณเมื่อ File System คืนไฟล์ไม่เรียงลำดับ  
  → เปลี่ยนเป็น Set-Based Dedup (500 IDs)

**🟡 Improvements:**
- **Safety Net:** `CheckNewPositions()` ตรวจจับ Position ที่ OnTradeTransaction พลาด (ทุก 100ms)
- **Auto-Sync on Restart:** Master restart → ส่ง SIGNAL_OPEN ทุก Position → Slave กรอง duplicate
- **Filling Mode Auto-Detect:** ตรวจจับ IOC/FOK/RETURN จาก `SYMBOL_FILLING_MODE` แทน hard-code

### v1.0 — Initial Release (2026-04-08)
- Local & Remote Copy Trade
- Fuzzy Deep Scan Symbol Mapper
- Price Matching (EXEC_MATCH_MASTER)
- Web Dashboard (Bento UI)
- Pending Order Support

---

## 🛡 ข้อจำกัดที่ควรรู้
1. **เรื่องของราคาข้าม Broker:** หากเทรด Market Orders ระหว่างสองโบรกเกอร์ที่ราคาต่างกัน ราคาเข้าอาจไม่ตรง 100% — ระบบ v1.2 ใช้ 3-tier matching (ลอง master price ก่อน → fallback market) ช่วยให้ราคาใกล้เคียงที่สุด
2. **Broker เดียวกัน:** ใช้โหมด `EXEC_MATCH_MASTER` จะช่วยให้ราคาตรงกัน (ต่างกันไม่เกิน 1-5 points)
3. **Position เดิมก่อนรัน EA:** ถ้า Master มี position เปิดอยู่ก่อนรัน CopyTrade ให้ใช้ `InpSyncExisting = false` (ค่า default) เพื่อป้องกัน Slave เปิดซ้ำที่ราคาตลาดปัจจุบัน
4. โฟลเดอร์ต้นขั้วทั้งหมด ต้องอยู่ใน `<MT5_Data_Folder>\MQL5\Include\CopyTrade\...` ห้ามเปลี่ยนชื่อโฟลเดอร์ไม่งั้น Include ไฟล์ไม่เจอ

---

*CopyTrade System v1.2 — Institutional Cross-Broker Execution Engine*
