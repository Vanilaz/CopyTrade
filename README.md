# CopyTrade MT5 — ระบบ Copy Trade ข้ามเครื่อง ข้าม Broker (Institutional Grade)

## 🎯 ความสามารถหลัก

| Feature | รายละเอียด |
|---|---|
| ✅ **Fuzzy Deep Scan** | จับคู่ชื่อ Symbol ข้าม Broker อัตโนมัติ (เช่น XAUUSD -> XAUUSD.std) โบรกเกอร์ชื่อแปลกแค่ไหนก็หากันเจอ |
| ✅ **Local Copy** | Copy ในเครื่องเดียวกัน / VPS เดียวกัน ผ่าน Localhost (เร็ว <10ms) |
| ✅ **Remote Copy** | Copy ข้าม VPS หรือคนละประเทศผ่าน TCP Socket + Relay Server (Node.js) |
| ✅ **Price Matching** | จับราคา fill จริงของ Master แล้วส่งให้ Slave ยิงตามราคาเดิมด้วย slippage แค่ 5 pt |
| ✅ **Auto Account ID** | ผูกระบบด้วยเลขบัญชีเข้าเทรด Master ทันที ไม่ต้องกรอก Token ให้ยุ่งยาก |
| ✅ **Exact Match SL/TP**| คำนวณความห่างของ SL/TP จาก Master แล้วแปลงเป็นระยะ Point ให้ Slave เป๊ะๆ |
| ✅ **Pending Orders** | รองรับไม้ Pending ทุกประเภท (Buy Limit, Sell Stop, etc.) |
| ✅ **Auto-Reconnect** | หากเน็ตหลุด / เซิร์ฟเวอร์รีสตาร์ท EA จะเชื่อมต่อกลับเองแบบอัตโนมัติ |
| ✅ **Bento Dashboard** | แจ้งเตือนสถานะบัญชีแบบสดๆ (Live) ด้วยหน้าต่างบัญชาการสไตล์ Bento Box แสดง Margin, Balance, Equity และ Floating PnL ของทุกบัญชี |

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
| `AUTH_TOKEN` | `copytrade2025` | Token สำหรับยืนยันตัวตน (ยังไม่ได้ enforce) |

ตั้งค่าผ่าน Environment:
```bash
# Linux
TCP_PORT=5555 HTTP_PORT=8080 node server.js

# Windows
set TCP_PORT=5555 && set HTTP_PORT=8080 && node server.js
```

---

## 🖧 โครงสร้าง Network (Architecture)

```
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
│  VPS-A   │5555│  VPS-A / VPS-C    │5555│  VPS-B   │
└──────────┘    └───────────────────┘    └──────────┘
```

- **Master EA** → เทรดปกติ → จับ deal → ส่ง signal ไปยัง Relay Server
- **Relay Server** → รับ signal → กระจายส่งไปยัง Slave ทุกตัวที่เชื่อมอยู่
- **Slave EA** → รับ signal → เปิดออเดอร์ตาม Master (รองรับ Price Matching)
- **Dashboard** → เชื่อมต่อผ่าน WebSocket → แสดงผลแบบ Real-time

---

## 🚀 วิธีตั้งค่าใช้งานข้ามเครื่อง (คนละ VPS / คนละเครือข่าย)

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
| `EXEC_MARKET` | ใช้ราคาตลาดปัจจุบัน (แบบเดิม) | ข้าม Broker ที่ราคาต่างกัน |
| **`EXEC_MATCH_MASTER`** ⭐ | ส่งราคาที่ Master fill จริง + tight slippage 5pt | **Broker เดียวกัน (แนะนำ!)** |
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
3. **Manual Override:** กรณีที่โบรกเกอร์ 2 แห่งใช้คำศัพท์คนละโลก เช่น Master เป็น `XAUUSD` แต่ Slave เป็น `GOLD` คุณสามารถกรอกจับคู่เองได้ง่ายๆ ผ่านหน้า Setting (หรือ `SymbolMap.txt`) ระบบจะให้ความสำคัญกับคำสั่งของคุณเป็นอันดับ 1
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
├── Server/                           ← Relay Server (Node.js)
│   ├── server.js                     ← ตัวกลางส่ง Signal
│   ├── package.json                  ← Dependencies (ws)
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
│       ├── TransportLocal.mqh        ← การสื่อสารภายในเครื่อง (File-based)
│       ├── TransportRemote.mqh       ← การสื่อสารข้าม VPS (TCP Socket)
│       ├── JsonHelper.mqh            ← Serialize/Deserialize Signal เป็น JSON
│       ├── DashboardUI.mqh           ← Dashboard แสดงผลบนจอ MT5
│       └── Logger.mqh                ← ระบบ Log
│
├── Config/                           ← ไฟล์ Config (SymbolMap, etc.)
└── README.md                         ← ไฟล์นี้
```

---

## 🛡️ Checklist ก่อน Go Live

- [ ] **Relay Server** — รันเป็น Service (systemd/NSSM) ไม่ใช่แค่เปิด CMD ทิ้งไว้
- [ ] **Firewall** — เปิด Port 5555 (TCP) ให้เฉพาะ IP ของ VPS ที่ใช้ Master/Slave
- [ ] **Dashboard** — Port 8080 เปิดเฉพาะ IP ส่วนตัวของคุณ (อย่าเปิดให้ทั้งโลก)
- [ ] **MT5 Settings** — เปิด `Allow Algo Trading` + `Allow DLL Imports`
- [ ] **Node.js Version** — ใช้ LTS เท่านั้น (18.x หรือ 20.x)
- [ ] **ทดสอบ** — เปิด Demo Account ทดสอบก่อนใช้ Real เสมอ
- [ ] **Execution Mode** — ถ้า Broker เดียวกัน ตั้ง `EXEC_MATCH_MASTER` ถ้าต่าง Broker ใช้ `EXEC_MARKET`
- [ ] **Monitor** — เปิด Dashboard ดู Signal / Latency ตลอดเวลาในช่วงแรก

---

## 🛡 ข้อจำกัดที่ควรรู้
1. **เรื่องของราคาข้าม Broker:** หากคุณเทรด Market Orders ระหว่างสองโบรกเกอร์ที่ราคาประเมินตลาดต่างกัน "ราคาเข้าของคุณ (Open Price) จะไม่มีทางเท่ากันเป๊ะ 100%" ฝั่ง Slave จะได้ราคาที่ดีที่สุดของโบรกเกอร์นั้นในวินาทีที่จับสัญญาณได้ (ซึ่งบ่อยครั้ง Slave อาจได้ราคาดีกว่า Master ด้วยซ้ำ)
2. **Broker เดียวกัน:** ใช้โหมด `EXEC_MATCH_MASTER` จะช่วยให้ราคาตรงกันมากที่สุด (ต่างกันไม่เกิน 1-5 points)
3. โฟลเดอร์ต้นขั้วทั้งหมด ต้องอยู่ใน `<MT5_Data_Folder>\MQL5\Include\CopyTrade\...` ห้ามเปลี่ยนชื่อโฟลเดอร์ไม่งั้น Include ไฟล์ไม่เจอ

---

*CopyTrade System v1.0 — Institutional Cross-Broker Execution Engine*
