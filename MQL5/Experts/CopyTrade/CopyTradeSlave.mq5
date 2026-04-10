//+------------------------------------------------------------------+
//|                                          CopyTradeSlave.mq5      |
//|                    Slave EA — รับ Signal & Execute Exact Match   |
//|                    รองรับ Local/Remote + Cross-Broker             |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.00"
#property description "CopyTrade Slave — รับ Signal แล้ว copy order เป๊ะๆ"
#property strict

//--- Include Libraries
#include <CopyTrade\CopyTradeDefines.mqh>
#include <CopyTrade\JsonHelper.mqh>
#include <CopyTrade\SymbolMapper.mqh>
#include <CopyTrade\TradeExecutor.mqh>
#include <CopyTrade\FileTransport.mqh>
#include <CopyTrade\SocketTransport.mqh>
#include <CopyTrade\DashboardUI.mqh>

//+------------------------------------------------------------------+
//| Input Parameters                                                  |
//+------------------------------------------------------------------+
input group "═══════════ ตั้งค่า Slave ═══════════"
input string   InpSlaveID         = "SLAVE_001";        // Slave ID
input long     InpMasterAccount   = 0;                  // ติดตาม Master Account (0 = รับทุก Master)
string         g_masterID         = "";

input group "═══════════ โหมดการรับ ═══════════"
input ENUM_COPY_MODE InpCopyMode  = COPY_BOTH;          // โหมด Copy

input group "═══════════ Remote Server ═══════════"
input string   InpRelayHost       = "127.0.0.1";        // Relay Server IP
input int      InpRelayPort       = 5555;               // Relay Server Port

input group "═══════════ Lot ═══════════"
input ENUM_LOT_MODE InpLotMode    = LOT_EXACT;          // วิธีคำนวณ Lot
input double   InpLotRatio        = 1.0;                // Ratio (สำหรับ LOT_RATIO)
input double   InpFixedLot        = 0.1;                // Fixed Lot (สำหรับ LOT_FIXED)
input double   InpRiskPercent     = 2.0;                // Risk % (สำหรับ LOT_BALANCE)

input group "═══════════ Symbol Mapping (ข้าม Broker) ═══════════"
input string   InpSymbolSuffix    = "";                  // เติมท้าย Symbol (เช่น m, .i)
input string   InpSymbolPrefix    = "";                  // เติมหน้า Symbol (เช่น #)
input bool     InpAutoDetect      = true;                // Auto-detect Broker format
input string   InpSymbolMapFile   = "symbol_map.csv";    // ไฟล์ mapping (CSV)

input group "═══════════ ฟิลเตอร์ ═══════════"
input double   InpMaxSpread       = 30;                  // Spread สูงสุด (points)
input int      InpMaxSlippage     = 20;                  // Slippage สูงสุด (points)
input bool     InpCopyPending     = true;                // Copy Pending Orders
input bool     InpCopySLTP        = true;                // Copy SL/TP

input group "═══════════ ราคา (Execution) ═══════════"
input ENUM_EXEC_MODE InpExecMode  = EXEC_MATCH_MASTER;   // โหมด Execution (แนะนำ: MATCH_MASTER)
input int      InpMatchSlippage   = 30;                  // Match Mode: Deviation สูงสุด (points)
input int      InpStalePriceMs    = 5000;                // Signal เก่าเกินกี่ ms ใช้ Market แทน (เพิ่มเป็น 5s เผื่อ cross-broker)

input group "═══════════ ขั้นสูง ═══════════"
input int      InpMagic           = 900001;              // Magic Number
input int      InpMaxRetries      = 3;                   // Retry จำนวนรอบ
input int      InpTimerMs         = 50;                  // Timer interval (ms) — เร็วขึ้น 2x
input ENUM_LOG_LEVEL InpLogLevel  = LOG_INFO;            // Log Level

//+------------------------------------------------------------------+
//| Global Variables                                                  |
//+------------------------------------------------------------------+
CFileTransport    *g_fileTransport;
CSocketTransport  *g_socketTransport;
CSymbolMapper     *g_symbolMapper;
CTradeExecutor    *g_executor;
CDashboardUI      g_ui;

//--- Ticket mapping: Master → Slave
TicketMap          g_ticketMap[];
int                g_mapCount = 0;

//--- State
bool               g_initialized = false;
int                g_signalsReceived = 0;
int                g_tradesExecuted = 0;
int                g_tradesFailed = 0;
datetime           g_lastHeartbeat = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   g_masterID = (InpMasterAccount > 0) ? IntegerToString(InpMasterAccount) : "";

   CTLog(LOG_INFO, "═══════════════════════════════════════════");
   CTLog(LOG_INFO, "  CopyTrade SLAVE v1.0 Starting...");
   CTLog(LOG_INFO, "  Slave ID: " + InpSlaveID);
   CTLog(LOG_INFO, "  Following Master: " + (g_masterID == "" ? "ALL" : g_masterID));
   CTLog(LOG_INFO, "  Mode: " + EnumToString(InpCopyMode));
   CTLog(LOG_INFO, "═══════════════════════════════════════════");

   //--- Initialize Symbol Mapper
   g_symbolMapper = new CSymbolMapper();
   g_symbolMapper.SetSuffix(InpSymbolSuffix);
   g_symbolMapper.SetPrefix(InpSymbolPrefix);
   g_symbolMapper.SetAutoDetect(InpAutoDetect);
   g_symbolMapper.LoadMapFile(InpSymbolMapFile);

   if(InpAutoDetect && InpSymbolSuffix == "" && InpSymbolPrefix == "")
      g_symbolMapper.AutoDetectBrokerFormat();

   //--- Initialize Trade Executor
   g_executor = new CTradeExecutor();
   g_executor.SetMapper(g_symbolMapper);
   g_executor.SetLotMode(InpLotMode);
   g_executor.SetLotRatio(InpLotRatio);
   g_executor.SetFixedLot(InpFixedLot);
   g_executor.SetRiskPercent(InpRiskPercent);
   g_executor.SetMaxRetries(InpMaxRetries);
   g_executor.SetMaxSpread(InpMaxSpread);
   g_executor.SetSlippage(InpMaxSlippage);
   g_executor.SetMagic(InpMagic);
   g_executor.SetExecMode(InpExecMode);
   g_executor.SetMatchSlippage(InpMatchSlippage);
   g_executor.SetStalePriceMs(InpStalePriceMs);

   //--- Initialize File Transport (Local)
   if(InpCopyMode == COPY_LOCAL || InpCopyMode == COPY_BOTH)
   {
      g_fileTransport = new CFileTransport();
      g_fileTransport.SetMasterID(g_masterID);
      if(!g_fileTransport.Init())
      {
         CTLog(LOG_ERROR, "File Transport init failed!");
         return INIT_FAILED;
      }
      CTLog(LOG_INFO, "📁 File Transport: Ready");
   }

   //--- Initialize Socket Transport (Remote)
   if(InpCopyMode == COPY_REMOTE || InpCopyMode == COPY_BOTH)
   {
      g_socketTransport = new CSocketTransport();
      g_socketTransport.SetHost(InpRelayHost);
      g_socketTransport.SetPort(InpRelayPort);
      g_socketTransport.SetToken("");
      g_socketTransport.SetID(InpSlaveID);
      g_socketTransport.SetRole(ROLE_SLAVE);

      if(!g_socketTransport.Connect())
         CTLog(LOG_WARN, "⚠ Socket Transport: Not connected (will retry)");
      else
      {
         CTLog(LOG_INFO, "🔗 Socket Transport: Connected");
         g_socketTransport.Subscribe(g_masterID);
      }
   }

   //--- Load ticket map from file
   LoadTicketMap();

   //--- Set timer
   if(!EventSetMillisecondTimer(InpTimerMs))
      EventSetTimer(1);

   g_initialized = true;
   CTLog(LOG_INFO, "✅ Slave EA initialized — waiting for signals");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();

   //--- Save ticket map
   SaveTicketMap();

   if(g_fileTransport != NULL)
   {
      delete g_fileTransport;
      g_fileTransport = NULL;
   }

   if(g_socketTransport != NULL)
   {
      g_socketTransport.Disconnect();
      delete g_socketTransport;
      g_socketTransport = NULL;
   }

   if(g_symbolMapper != NULL)
   {
      delete g_symbolMapper;
      g_symbolMapper = NULL;
   }

   if(g_executor != NULL)
   {
      delete g_executor;
      g_executor = NULL;
   }

   CTLog(LOG_INFO, "Slave EA stopped. Received: " + IntegerToString(g_signalsReceived) +
         " Executed: " + IntegerToString(g_tradesExecuted) +
         " Failed: " + IntegerToString(g_tradesFailed));
}

//+------------------------------------------------------------------+
//| Timer: Poll for signals                                           |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!g_initialized) return;

   //--- Read signals from File Transport
   if(g_fileTransport != NULL)
   {
      TradeSignal fileSignals[];
      int fileCount = g_fileTransport.ReadSignals(fileSignals);
      for(int i = 0; i < fileCount; i++)
      {
         if(fileSignals[i].masterID == g_masterID || g_masterID == "")
            ProcessSignal(fileSignals[i]);
      }
   }

   //--- Read signals from Socket Transport
   if(g_socketTransport != NULL)
   {
      if(!g_socketTransport.IsConnected())
      {
         g_socketTransport.TryReconnect();
         if(g_socketTransport.IsConnected())
            g_socketTransport.Subscribe(g_masterID);
      }
      else
      {
         TradeSignal socketSignals[];
         int socketCount = g_socketTransport.ReceiveSignals(socketSignals);
         for(int i = 0; i < socketCount; i++)
         {
            if(socketSignals[i].masterID == g_masterID || g_masterID == "")
               ProcessSignal(socketSignals[i]);
         }

         // Heartbeat
         datetime now = TimeCurrent();
         if(now - g_lastHeartbeat >= CT_HEARTBEAT_SEC)
         {
            g_lastHeartbeat = now;
            g_socketTransport.SendHeartbeat();
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Process received trade signal                                     |
//+------------------------------------------------------------------+
void ProcessSignal(const TradeSignal &sig)
{
   g_signalsReceived++;

   // Check slave target
   if(sig.slaveID != "" && sig.slaveID != InpSlaveID)
      return;

   CTLog(LOG_INFO, "📥 RECEIVED: " + SignalTypeToString(sig.type) +
         " " + sig.symbol + " ticket=" + IntegerToString(sig.ticket));

   switch(sig.type)
   {
      case SIGNAL_OPEN:
         HandleOpen(sig);
         break;

      case SIGNAL_CLOSE:
         HandleClose(sig);
         break;

      case SIGNAL_MODIFY:
         HandleModify(sig);
         break;

      case SIGNAL_PARTIAL_CLOSE:
         HandlePartialClose(sig);
         break;

      case SIGNAL_PENDING_OPEN:
         if(InpCopyPending) HandlePendingOpen(sig);
         break;

      case SIGNAL_PENDING_MODIFY:
         if(InpCopyPending) HandlePendingModify(sig);
         break;

      case SIGNAL_PENDING_DELETE:
         if(InpCopyPending) HandlePendingDelete(sig);
         break;

      case SIGNAL_HEARTBEAT:
         // Heartbeat — do nothing
         break;
   }
}

//+------------------------------------------------------------------+
//| Handle OPEN signal                                                |
//+------------------------------------------------------------------+
void HandleOpen(const TradeSignal &sig)
{
   // Check for duplicate
   if(FindSlaveTicket(sig.positionID) >= 0)
   {
      CTLog(LOG_WARN, "Duplicate signal — position already copied: " +
            IntegerToString(sig.positionID));
      return;
   }

   // Map symbol
   string slaveSymbol = g_symbolMapper.MapSymbol(sig.symbol);
   if(slaveSymbol == "")
   {
      CTLog(LOG_ERROR, "Cannot map symbol: " + sig.symbol);
      g_tradesFailed++;
      return;
   }

   // Execute
   long slaveTicket = g_executor.ExecuteOpen(sig, slaveSymbol);
   if(slaveTicket > 0)
   {
      // Save mapping
      AddTicketMap(sig.ticket, slaveTicket, sig.positionID, slaveTicket, sig.symbol, sig.lots);
      g_tradesExecuted++;
      CTLog(LOG_INFO, "✅ COPIED: Master #" + IntegerToString(sig.positionID) +
            " → Slave #" + IntegerToString(slaveTicket));
   }
   else
   {
      g_tradesFailed++;
      CTLog(LOG_ERROR, "❌ COPY FAILED: " + sig.symbol);
   }
}

//+------------------------------------------------------------------+
//| Handle CLOSE signal                                               |
//+------------------------------------------------------------------+
void HandleClose(const TradeSignal &sig)
{
   int idx = FindSlaveTicket(sig.positionID);
   if(idx < 0)
   {
      CTLog(LOG_WARN, "Close signal: Master position not found in map: " +
            IntegerToString(sig.positionID));
      return;
   }

   string slaveSymbol = g_symbolMapper.MapSymbol(sig.symbol);
   long slavePos = g_ticketMap[idx].slavePositionID;

   if(g_executor.ExecuteClose(slavePos, slaveSymbol))
   {
      RemoveTicketMap(idx);
      g_tradesExecuted++;
   }
   else
      g_tradesFailed++;
}

//+------------------------------------------------------------------+
//| Handle MODIFY signal (SL/TP)                                      |
//+------------------------------------------------------------------+
void HandleModify(const TradeSignal &sig)
{
   if(!InpCopySLTP) return;

   int idx = FindSlaveTicket(sig.positionID);
   if(idx < 0)
   {
      CTLog(LOG_WARN, "Modify signal: Master position not found: " +
            IntegerToString(sig.positionID));
      return;
   }

   long slavePos = g_ticketMap[idx].slavePositionID;
   string slaveSymbol = g_symbolMapper.MapSymbol(sig.symbol);

   // Convert SL/TP using pip distance
   double slaveEntry = 0;
   if(PositionSelectByTicket((ulong)slavePos))
      slaveEntry = PositionGetDouble(POSITION_PRICE_OPEN);

   double newSL = 0, newTP = 0;
   if(sig.sl != 0)
      newSL = g_symbolMapper.ConvertSLTP(sig.price, sig.sl, sig.symbol, slaveSymbol, slaveEntry);
   if(sig.tp != 0)
      newTP = g_symbolMapper.ConvertSLTP(sig.price, sig.tp, sig.symbol, slaveSymbol, slaveEntry);

   if(g_executor.ExecuteModify(slavePos, newSL, newTP))
      g_tradesExecuted++;
   else
      g_tradesFailed++;
}

//+------------------------------------------------------------------+
//| Handle PARTIAL_CLOSE signal                                       |
//+------------------------------------------------------------------+
void HandlePartialClose(const TradeSignal &sig)
{
   int idx = FindSlaveTicket(sig.positionID);
   if(idx < 0)
   {
      CTLog(LOG_WARN, "Partial close: Master position not found: " +
            IntegerToString(sig.positionID));
      return;
   }

   long slavePos = g_ticketMap[idx].slavePositionID;

   if(g_executor.ExecutePartialClose(slavePos, sig.closePercent))
   {
      g_tradesExecuted++;
      // Update lots in map
      if(PositionSelectByTicket((ulong)slavePos))
         g_ticketMap[idx].lots = PositionGetDouble(POSITION_VOLUME);
   }
   else
      g_tradesFailed++;
}

//+------------------------------------------------------------------+
//| Handle PENDING OPEN signal                                        |
//+------------------------------------------------------------------+
void HandlePendingOpen(const TradeSignal &sig)
{
   string slaveSymbol = g_symbolMapper.MapSymbol(sig.symbol);
   if(slaveSymbol == "")
   {
      g_tradesFailed++;
      return;
   }

   long slaveTicket = g_executor.ExecutePendingOpen(sig, slaveSymbol);
   if(slaveTicket > 0)
   {
      AddTicketMap(sig.ticket, slaveTicket, sig.positionID, slaveTicket, sig.symbol, sig.lots);
      g_tradesExecuted++;
   }
   else
      g_tradesFailed++;
}

//+------------------------------------------------------------------+
//| Handle PENDING MODIFY signal                                      |
//+------------------------------------------------------------------+
void HandlePendingModify(const TradeSignal &sig)
{
   int idx = FindSlaveTicket(sig.ticket);
   if(idx < 0) return;

   long slaveTicket = g_ticketMap[idx].slaveTicket;
   string slaveSymbol = g_symbolMapper.MapSymbol(sig.symbol);
   int digits = (int)SymbolInfoInteger(slaveSymbol, SYMBOL_DIGITS);

   double newSL = 0, newTP = 0;
   if(sig.sl != 0)
      newSL = g_symbolMapper.ConvertSLTP(sig.price, sig.sl, sig.symbol, slaveSymbol, sig.price);
   if(sig.tp != 0)
      newTP = g_symbolMapper.ConvertSLTP(sig.price, sig.tp, sig.symbol, slaveSymbol, sig.price);

   g_executor.ExecutePendingModify(slaveTicket, NormalizeDouble(sig.price, digits), newSL, newTP);
}

//+------------------------------------------------------------------+
//| Handle PENDING DELETE signal                                      |
//+------------------------------------------------------------------+
void HandlePendingDelete(const TradeSignal &sig)
{
   int idx = FindSlaveTicket(sig.ticket);
   if(idx < 0) return;

   long slaveTicket = g_ticketMap[idx].slaveTicket;
   
   // ถ้าเป็น Pending order ที่ยัง active อยู่
   if(OrderSelect((ulong)slaveTicket))
   {
      if(g_executor.ExecutePendingDelete(slaveTicket))
         RemoveTicketMap(idx);
   }
   else
   {
      // อาจจะ fill เป็น position ไปแล้ว ไม่ต้องสนใจ PENDING_DELETE หลอกๆ
      CTLog(LOG_DEBUG, "HandlePendingDelete: Slave ticket " + IntegerToString(slaveTicket) + " is not an active pending order.");
   }
}

//+------------------------------------------------------------------+
//| Ticket Map: Find slave ticket by master position ID               |
//+------------------------------------------------------------------+
int FindSlaveTicket(long masterPosID)
{
   for(int i = 0; i < g_mapCount; i++)
   {
      if(g_ticketMap[i].masterPositionID == masterPosID ||
         g_ticketMap[i].masterTicket == masterPosID)
         return i;
   }
   return -1;
}

//+------------------------------------------------------------------+
//| Ticket Map: Add mapping                                           |
//+------------------------------------------------------------------+
void AddTicketMap(long masterTicket, long slaveTicket,
                  long masterPosID, long slavePosID,
                  string symbol, double lots)
{
   g_mapCount++;
   ArrayResize(g_ticketMap, g_mapCount);
   g_ticketMap[g_mapCount - 1].masterTicket     = masterTicket;
   g_ticketMap[g_mapCount - 1].slaveTicket      = slaveTicket;
   g_ticketMap[g_mapCount - 1].masterPositionID = masterPosID;
   g_ticketMap[g_mapCount - 1].slavePositionID  = slavePosID;
   g_ticketMap[g_mapCount - 1].symbol           = symbol;
   g_ticketMap[g_mapCount - 1].lots             = lots;

   SaveTicketMap();
}

//+------------------------------------------------------------------+
//| Ticket Map: Remove mapping                                        |
//+------------------------------------------------------------------+
void RemoveTicketMap(int idx)
{
   if(idx < 0 || idx >= g_mapCount) return;

   for(int i = idx; i < g_mapCount - 1; i++)
      g_ticketMap[i] = g_ticketMap[i + 1];

   g_mapCount--;
   ArrayResize(g_ticketMap, g_mapCount);
   SaveTicketMap();
}

//+------------------------------------------------------------------+
//| Save ticket map to file (persist across EA restart)               |
//+------------------------------------------------------------------+
void SaveTicketMap()
{
   string filepath = CT_FILE_DIR + InpSlaveID + "_" + CT_MAP_FILE;
   int handle = FileOpen(filepath, FILE_WRITE | FILE_TXT | FILE_ANSI);
   if(handle == INVALID_HANDLE) return;

   for(int i = 0; i < g_mapCount; i++)
   {
      string line = IntegerToString(g_ticketMap[i].masterTicket) + "," +
                    IntegerToString(g_ticketMap[i].slaveTicket) + "," +
                    IntegerToString(g_ticketMap[i].masterPositionID) + "," +
                    IntegerToString(g_ticketMap[i].slavePositionID) + "," +
                    g_ticketMap[i].symbol + "," +
                    DoubleToString(g_ticketMap[i].lots, 4);
      FileWriteString(handle, line + "\n");
   }
   FileClose(handle);
}

//+------------------------------------------------------------------+
//| Load ticket map from file                                         |
//+------------------------------------------------------------------+
void LoadTicketMap()
{
   string filepath = CT_FILE_DIR + InpSlaveID + "_" + CT_MAP_FILE;
   int handle = FileOpen(filepath, FILE_READ | FILE_TXT | FILE_ANSI);
   if(handle == INVALID_HANDLE) return;

   g_mapCount = 0;

   while(!FileIsEnding(handle))
   {
      string line = FileReadString(handle);
      if(StringLen(line) == 0) continue;

      string parts[];
      if(StringSplit(line, ',', parts) >= 6)
      {
         g_mapCount++;
         ArrayResize(g_ticketMap, g_mapCount);
         g_ticketMap[g_mapCount - 1].masterTicket     = StringToInteger(parts[0]);
         g_ticketMap[g_mapCount - 1].slaveTicket      = StringToInteger(parts[1]);
         g_ticketMap[g_mapCount - 1].masterPositionID = StringToInteger(parts[2]);
         g_ticketMap[g_mapCount - 1].slavePositionID  = StringToInteger(parts[3]);
         g_ticketMap[g_mapCount - 1].symbol           = parts[4];
         g_ticketMap[g_mapCount - 1].lots             = StringToDouble(parts[5]);
      }
   }
   FileClose(handle);

   if(g_mapCount > 0)
      CTLog(LOG_INFO, "Loaded " + IntegerToString(g_mapCount) + " ticket mappings");
}

//+------------------------------------------------------------------+
//| Tick function — display status                                    |
//+------------------------------------------------------------------+
void OnTick()
{
   string props[7], vals[7];
   
   props[0] = "Following Master:";
   vals[0] = (g_masterID == "") ? "Waiting..." : g_masterID;
   
   props[1] = "Copy Mode:";
   vals[1] = EnumToString(InpCopyMode);
   
   props[2] = "Lot Rules:";
   vals[2] = EnumToString(InpLotMode);
   if(InpLotMode == LOT_RATIO) vals[2] += " (" + DoubleToString(InpLotRatio, 1) + "x)";
   if(InpLotMode == LOT_FIXED) vals[2] += " (" + DoubleToString(InpFixedLot, 1) + ")";
   
   props[3] = "Server Status:";
   if(InpCopyMode == COPY_LOCAL)
      vals[3] = "Local IPC Only";
   else
      vals[3] = (g_socketTransport != NULL && g_socketTransport.IsConnected()) ? "🟢 Connected" : "🔴 Disconnected";
      
   props[4] = "Signals Rx:";
   vals[4] = IntegerToString(g_signalsReceived);
   
   props[5] = "Win / Fail:";
   vals[5] = IntegerToString(g_tradesExecuted) + " / " + IntegerToString(g_tradesFailed);
   
   props[6] = "Active Maps:";
   vals[6] = IntegerToString(g_mapCount);
   
   g_ui.Draw("CopyTrade SLAVE - " + InpSlaveID, props, vals, 7, false);
}
//+------------------------------------------------------------------+
