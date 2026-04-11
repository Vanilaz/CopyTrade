# CopyTrade Pro Dashboard — Live Neural Relay

แผงควบคุมอัจฉริยะสำหรับระบบ CopyTrade MT5 ที่ใช้สถาปัตยกรรม **Clean Architecture (Hexagonal)** และการส่งข้อมูลแบบ **High-Frequency Live Streaming**

## 🚀 เทคโนโลยีที่ใช้
- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS + Lucide Icons
- **Backend**: Node.js + TypeScript + WebSocket + TCP Socket
- **Architecture**: Hexagonal Pattern (Separation of Domain, Application, and Adapters)

## ⚡ คุณสมบัติเด่น (Live Features)
- **Neural Relay Engine**: ระบบกระจายข้อมูลความถี่สูง Broadcast ทุกๆ 200ms
- **TradingView Fidelity**: เก็บข้อมูล Equity ทุก 1 วินาที เพื่อกราฟที่ลื่นไหลที่สุด
- **Visual Tickers**: ระบบแจ้งเตือนการเปลี่ยนแปลงราคาด้วยการกระพริบสี (Flash)
- **Zero-Refresh Workflow**: เชื่อมต่อใหม่เองโดยอัตโนมัติ (Auto-Reconnect) ไม่ต้องกด F5

## 🛠️ วิธีการรัน
1. ติดตั้ง Dependencies: `npm install`
2. Build ระบบ: `npm run build`
3. เริ่มต้นทำงาน: `npm start`

## 📂 โครงสร้าง Backend (Server)
- `server/domain`: แกนกลางของระบบ (Entities, Logic, Ports)
- `server/application`: ขั้นตอนการทำงาน (Use Cases)
- `server/adapters`: การเชื่อมต่อภายนอก (TCP, HTTP, WebSocket, File, Telegram)
- `server/infrastructure`: การตั้งค่าและระบบเสริม (Scheduler, Config)
