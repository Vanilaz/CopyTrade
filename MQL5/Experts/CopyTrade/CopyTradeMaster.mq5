//+------------------------------------------------------------------+
//|                                         CopyTradeMaster.mq5      |
//|                    Master EA — ตรวจจับ Trade Events & ส่ง Signal  |
//|                    รองรับ Local (File) + Remote (TCP Socket)      |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.00"
#property description "CopyTrade Master — ส่ง Signal จากทุก trade event"
#property strict

//--- Include Libraries
#include <CopyTrade\CopyTradeDefines.mqh>
#include <CopyTrade\JsonHelper.mqh>
#include <CopyTrade\FileTransport.mqh>
#include <CopyTrade\SocketTransport.mqh>
#include <CopyTrade\DashboardUI.mqh>

//+------------------------------------------------------------------+
//| Input Parameters                                                  |
//+------------------------------------------------------------------+
input group "═══════════ ตั้งค่า Master ═══════════"
input int      InpMagicFilter    = 0;                  // Magic Number Filter (0=ทุก magic)
string         g_masterID        = "";                 // Master Account ID (Auto)

input group "═══════════ โหมดการส่ง ═══════════"
input ENUM_COPY_MODE InpCopyMode = COPY_BOTH;          // โหมด Copy
input bool     InpCopyPending    = true;               // Copy Pending Orders

input group "═══════════ Remote Server ═══════════"
input string   InpRelayHost      = "127.0.0.1";        // Relay Server IP
input int      InpRelayPort      = 5555;               // Relay Server Port

input group "═══════════ ขั้นสูง ═══════════"
input int      InpHeartbeatSec   = 5;                  // ส่ง Heartbeat ทุก (วินาที)
input int      InpTimerMs        = 100;                // Timer interval (ms)
input ENUM_LOG_LEVEL InpLogLevel = LOG_INFO;           // Log Level

//+------------------------------------------------------------------+
//| Global Variables                                                  |
//+------------------------------------------------------------------+
CFileTransport    *g_fileTransport;
CSocketTransport  *g_socketTransport;
CDashboardUI      g_ui;

//--- Position tracking
struct PositionInfo
{
   long   ticket;
   long   positionID;
   string symbol;
   int    type;
   double lots;
   double sl;
   double tp;
   double openPrice;
   int    magic;
};

PositionInfo      g_positions[];
int               g_posCount = 0;

//--- State
bool              g_initialized = false;
datetime          g_lastHeartbeat = 0;
datetime          g_lastCleanup = 0;
int               g_signalsSent = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                    |
//+------------------------------------------------------------------+
int OnInit()
{
   g_masterID = IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));

   CTLog(LOG_INFO, "═══════════════════════════════════════════");
   CTLog(LOG_INFO, "  CopyTrade MASTER v1.0 Starting...");
   CTLog(LOG_INFO, "  Master ID: " + g_masterID);
   CTLog(LOG_INFO, "  Mode: " + EnumToString(InpCopyMode));
   CTLog(LOG_INFO, "═══════════════════════════════════════════");

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
      g_socketTransport.SetID(g_masterID);
      g_socketTransport.SetRole(ROLE_MASTER);

      if(!g_socketTransport.Connect())
         CTLog(LOG_WARN, "⚠ Socket Transport: Not connected (will retry)");
      else
         CTLog(LOG_INFO, "🔗 Socket Transport: Connected");
   }

   //--- Snapshot current positions
   SnapshotPositions();

   //--- Set timer
   if(!EventSetMillisecondTimer(InpTimerMs))
      EventSetTimer(1);

   g_initialized = true;
   CTLog(LOG_INFO, "✅ Master EA initialized — monitoring " + IntegerToString(g_posCount) + " positions");
   return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                  |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();

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

   CTLog(LOG_INFO, "Master EA stopped. Total signals sent: " + IntegerToString(g_signalsSent));
}

//+------------------------------------------------------------------+
//| OnTradeTransaction — จับทุก trade event                          |
//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
{
   if(!g_initialized) return;

   //--- Only process DEAL_ADD (position open/close) and ORDER_UPDATE (modify)
   if(trans.type == TRADE_TRANSACTION_DEAL_ADD)
   {
      ProcessDealAdd(trans);
   }
   else if(trans.type == TRADE_TRANSACTION_ORDER_DELETE && InpCopyPending)
   {
      // Pending order cancelled
      ProcessPendingDelete(trans);
   }
}

//+------------------------------------------------------------------+
//| Process new deal (open/close position)                            |
//+------------------------------------------------------------------+
void ProcessDealAdd(const MqlTradeTransaction &trans)
{
   long dealTicket = trans.deal;
   if(dealTicket <= 0) return;

   // Get deal info
   if(!HistoryDealSelect(dealTicket)) return;

   ENUM_DEAL_ENTRY entry = (ENUM_DEAL_ENTRY)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
   ENUM_DEAL_TYPE  dtype = (ENUM_DEAL_TYPE)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
   long            magic = HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
   string          symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
   double          lots  = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
   double          price = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
   long            posID = HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
   string          comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);

   // Filter: Skip CopyTrade's own orders
   if(StringFind(comment, CT_COMMENT_PREFIX) >= 0) return;

   // Filter: Magic number
   if(InpMagicFilter > 0 && magic != InpMagicFilter) return;

   // Filter: Skip balance/credit operations
   if(dtype != DEAL_TYPE_BUY && dtype != DEAL_TYPE_SELL) return;

   TradeSignal sig;
   sig.Init();
   sig.masterID   = g_masterID;
   sig.ticket     = dealTicket;
   sig.positionID = posID;
   sig.symbol     = symbol;
   sig.lots       = lots;
   sig.price      = price;
   sig.fillPrice  = price;           // ราคาที่ Master fill ได้จริง
   sig.fillTimeMs = GetTickCount64();
   sig.magic      = (int)magic;
   sig.comment    = comment;

   if(entry == DEAL_ENTRY_IN)
   {
      //--- New position opened
      sig.type = SIGNAL_OPEN;
      sig.orderType = (dtype == DEAL_TYPE_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;

      // Get SL/TP from position
      if(PositionSelectByTicket((ulong)posID))
      {
         sig.sl = PositionGetDouble(POSITION_SL);
         sig.tp = PositionGetDouble(POSITION_TP);
      }

      CTLog(LOG_INFO, "📤 SIGNAL OPEN: " + OrderTypeToStr(sig.orderType) + " " +
            symbol + " " + DoubleToString(lots, 2) + " lots @ " + DoubleToString(price, 5));
   }
   else if(entry == DEAL_ENTRY_OUT)
   {
      //--- Position closed
      sig.type = SIGNAL_CLOSE;
      sig.orderType = (dtype == DEAL_TYPE_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;

      CTLog(LOG_INFO, "📤 SIGNAL CLOSE: " + symbol + " " +
            DoubleToString(lots, 2) + " lots @ " + DoubleToString(price, 5));
   }
   else if(entry == DEAL_ENTRY_INOUT)
   {
      //--- Position reversed (close + open opposite)
      // Send close first
      TradeSignal closeSig;
      closeSig.Init();
      closeSig.masterID   = g_masterID;
      closeSig.type       = SIGNAL_CLOSE;
      closeSig.ticket     = dealTicket;
      closeSig.positionID = posID;
      closeSig.symbol     = symbol;
      closeSig.lots       = lots;
      closeSig.price      = price;
      BroadcastSignal(closeSig);

      // Then open new direction
      sig.type = SIGNAL_OPEN;
      sig.orderType = (dtype == DEAL_TYPE_BUY) ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;

      CTLog(LOG_INFO, "📤 SIGNAL REVERSE: " + symbol);
   }

   BroadcastSignal(sig);
}

//+------------------------------------------------------------------+
//| Process pending order deletion                                    |
//+------------------------------------------------------------------+
void ProcessPendingDelete(const MqlTradeTransaction &trans)
{
   if(HistoryOrderSelect(trans.order))
   {
      long state = HistoryOrderGetInteger(trans.order, ORDER_STATE);
      // ถ้าสถานะเป็น FILLED แปลว่า Trigger เปลี่ยนเป็น Position แล้ว ไม่ต้องส่ง PENDING_DELETE
      if(state == ORDER_STATE_FILLED)
      {
         return;
      }
   }

   TradeSignal sig;
   sig.Init();
   sig.masterID   = g_masterID;
   sig.type       = SIGNAL_PENDING_DELETE;
   sig.ticket     = trans.order;
   sig.symbol     = trans.symbol;
   BroadcastSignal(sig);
}

//+------------------------------------------------------------------+
//| Timer: Check for modifications and partial closes                 |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(!g_initialized) return;

   //--- Check position modifications (SL/TP changes)
   CheckModifications();

   //--- Check for partial closes
   CheckPartialCloses();

   //--- Heartbeat
   datetime now = TimeCurrent();
   if(g_socketTransport != NULL && now - g_lastHeartbeat >= InpHeartbeatSec)
   {
      g_lastHeartbeat = now;
      if(!g_socketTransport.IsConnected())
         g_socketTransport.TryReconnect();
      else
         g_socketTransport.SendHeartbeat();
   }

   //--- Cleanup old files every 30 seconds
   if(g_fileTransport != NULL && now - g_lastCleanup >= 30)
   {
      g_lastCleanup = now;
      g_fileTransport.Cleanup();
   }

   //--- Update position snapshot
   SnapshotPositions();
}

//+------------------------------------------------------------------+
//| Check for SL/TP modifications                                    |
//+------------------------------------------------------------------+
void CheckModifications()
{
   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;

      if(!PositionSelectByTicket(ticket)) continue;

      string symbol = PositionGetString(POSITION_SYMBOL);
      double sl     = PositionGetDouble(POSITION_SL);
      double tp     = PositionGetDouble(POSITION_TP);
      long   magic  = PositionGetInteger(POSITION_MAGIC);
      string comment = PositionGetString(POSITION_COMMENT);

      // Skip CopyTrade's own
      if(StringFind(comment, CT_COMMENT_PREFIX) >= 0) continue;
      if(InpMagicFilter > 0 && magic != InpMagicFilter) continue;

      // Find in snapshot
      for(int j = 0; j < g_posCount; j++)
      {
         if(g_positions[j].positionID == (long)ticket)
         {
            // Check SL/TP changed
            if(MathAbs(g_positions[j].sl - sl) > 0.000001 ||
               MathAbs(g_positions[j].tp - tp) > 0.000001)
            {
               TradeSignal sig;
               sig.Init();
               sig.masterID   = g_masterID;
               sig.type       = SIGNAL_MODIFY;
               sig.ticket     = (long)ticket;
               sig.positionID = (long)ticket;
               sig.symbol     = symbol;
               sig.sl         = sl;
               sig.tp         = tp;
               sig.price      = PositionGetDouble(POSITION_PRICE_OPEN);

               CTLog(LOG_INFO, "📤 SIGNAL MODIFY: " + symbol +
                     " SL=" + DoubleToString(sl, 5) + " TP=" + DoubleToString(tp, 5));
               BroadcastSignal(sig);

               // Update snapshot
               g_positions[j].sl = sl;
               g_positions[j].tp = tp;
            }
            break;
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Check for partial closes                                          |
//+------------------------------------------------------------------+
void CheckPartialCloses()
{
   for(int j = 0; j < g_posCount; j++)
   {
      ulong ticket = (ulong)g_positions[j].positionID;
      if(PositionSelectByTicket(ticket))
      {
         double currentLots = PositionGetDouble(POSITION_VOLUME);
         if(currentLots < g_positions[j].lots - 0.001)
         {
            double closedLots = g_positions[j].lots - currentLots;
            double closePercent = (closedLots / g_positions[j].lots) * 100.0;

            TradeSignal sig;
            sig.Init();
            sig.masterID     = g_masterID;
            sig.type         = SIGNAL_PARTIAL_CLOSE;
            sig.ticket       = g_positions[j].ticket;
            sig.positionID   = g_positions[j].positionID;
            sig.symbol       = g_positions[j].symbol;
            sig.lots         = closedLots;
            sig.closePercent = closePercent;

            CTLog(LOG_INFO, "📤 SIGNAL PARTIAL CLOSE: " + g_positions[j].symbol +
                  " " + DoubleToString(closePercent, 1) + "%");
            BroadcastSignal(sig);

            g_positions[j].lots = currentLots;
         }
      }
   }
}

//+------------------------------------------------------------------+
//| Broadcast signal through all enabled transports                   |
//+------------------------------------------------------------------+
void BroadcastSignal(const TradeSignal &sig)
{
   bool fileSent   = false;
   bool socketSent = false;

   //--- File Transport (Local)
   if(g_fileTransport != NULL)
   {
      fileSent = g_fileTransport.WriteSignal(sig);
   }

   //--- Socket Transport (Remote)
   if(g_socketTransport != NULL)
   {
      if(g_socketTransport.IsConnected())
         socketSent = g_socketTransport.SendSignal(sig);
      else
      {
         g_socketTransport.TryReconnect();
         if(g_socketTransport.IsConnected())
            socketSent = g_socketTransport.SendSignal(sig);
      }
   }

   if(fileSent || socketSent)
      g_signalsSent++;

   string channels = "";
   if(fileSent)   channels += "File ";
   if(socketSent) channels += "Socket ";

   CTLog(LOG_DEBUG, "Signal broadcast via: " + channels +
         " Type=" + SignalTypeToString(sig.type) +
         " Symbol=" + sig.symbol);
}

//+------------------------------------------------------------------+
//| Snapshot all current positions                                    |
//+------------------------------------------------------------------+
void SnapshotPositions()
{
   int total = PositionsTotal();
   g_posCount = 0;
   ArrayResize(g_positions, total);

   for(int i = 0; i < total; i++)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket <= 0) continue;
      if(!PositionSelectByTicket(ticket)) continue;

      string comment = PositionGetString(POSITION_COMMENT);
      long magic = PositionGetInteger(POSITION_MAGIC);

      // Skip CopyTrade's own
      if(StringFind(comment, CT_COMMENT_PREFIX) >= 0) continue;
      if(InpMagicFilter > 0 && magic != InpMagicFilter) continue;

      g_positions[g_posCount].ticket      = (long)ticket;
      g_positions[g_posCount].positionID  = (long)ticket;
      g_positions[g_posCount].symbol      = PositionGetString(POSITION_SYMBOL);
      g_positions[g_posCount].type        = (int)PositionGetInteger(POSITION_TYPE);
      g_positions[g_posCount].lots        = PositionGetDouble(POSITION_VOLUME);
      g_positions[g_posCount].sl          = PositionGetDouble(POSITION_SL);
      g_positions[g_posCount].tp          = PositionGetDouble(POSITION_TP);
      g_positions[g_posCount].openPrice   = PositionGetDouble(POSITION_PRICE_OPEN);
      g_positions[g_posCount].magic       = (int)magic;
      g_posCount++;
   }
}

//+------------------------------------------------------------------+
//| Tick function — not heavy, just display                           |
//+------------------------------------------------------------------+
void OnTick()
{
   string props[5], vals[5];
   
   props[0] = "Master Account ID:";
   vals[0] = g_masterID;
   
   props[1] = "Copy Mode:";
   vals[1] = EnumToString(InpCopyMode);
   
   props[2] = "Active Positions:";
   vals[2] = IntegerToString(g_posCount);
   
   props[3] = "Server Status:";
   if(InpCopyMode == COPY_LOCAL)
      vals[3] = "Local IPC Only";
   else
      vals[3] = (g_socketTransport != NULL && g_socketTransport.IsConnected()) ? "🟢 Connected" : "🔴 Disconnected";
      
   props[4] = "Last Update:";
   vals[4] = TimeToString(TimeCurrent(), TIME_SECONDS);
   
   g_ui.Draw("CopyTrade MASTER", props, vals, 5, true);
}
//+------------------------------------------------------------------+
