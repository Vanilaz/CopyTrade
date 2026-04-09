//+------------------------------------------------------------------+
//|                                           CopyTradeDefines.mqh   |
//|                          CopyTrade System v1.0 — Definitions     |
//|                          Local + Remote + Cross-Broker Support   |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.00"

#ifndef COPYTRADE_DEFINES_MQH
#define COPYTRADE_DEFINES_MQH

//--- Protocol Version
#define CT_VERSION            "1.0"
#define CT_MAGIC_BASE         900000
#define CT_COMMENT_PREFIX     "CT_"

//--- File Transport
#define CT_FILE_DIR           "copytrade\\"
#define CT_SIGNAL_PREFIX      "sig_"
#define CT_SIGNAL_EXT         ".json"
#define CT_MAP_FILE           "ticket_map.dat"
#define CT_POLL_MS            100        // File poll interval ms
#define CT_FILE_MAX_AGE_SEC   60         // Delete signals older than 60s

//--- Socket Transport
#define CT_SOCKET_TIMEOUT     5000       // Socket timeout ms
#define CT_RECONNECT_SEC      3          // Reconnect interval
#define CT_HEARTBEAT_SEC      5          // Heartbeat interval
#define CT_HEADER_SIZE        4          // 4-byte length header
#define CT_MAX_MSG_SIZE       8192       // Max message size

//--- Signal Types
enum ENUM_SIGNAL_TYPE
{
   SIGNAL_OPEN = 0,              // เปิด Position ใหม่
   SIGNAL_CLOSE,                 // ปิด Position ทั้งหมด
   SIGNAL_MODIFY,                // แก้ไข SL/TP
   SIGNAL_PARTIAL_CLOSE,         // ปิดบางส่วน
   SIGNAL_PENDING_OPEN,          // วาง Pending Order
   SIGNAL_PENDING_MODIFY,        // แก้ไข Pending Order
   SIGNAL_PENDING_DELETE,        // ลบ Pending Order
   SIGNAL_HEARTBEAT              // Heartbeat
};

//--- Copy Mode
enum ENUM_COPY_MODE
{
   COPY_LOCAL = 0,               // Local Only (File-based)
   COPY_REMOTE,                  // Remote Only (TCP Socket)
   COPY_BOTH                     // ทั้ง Local + Remote
};

//--- Lot Calculation Mode
enum ENUM_LOT_MODE
{
   LOT_EXACT = 0,                // เท่า Master เป๊ะ
   LOT_RATIO,                    // คูณ Ratio
   LOT_FIXED,                    // Lot คงที่
   LOT_BALANCE                   // คำนวณตาม Balance %
};

//--- Execution Mode (วิธี match ราคากับ Master)
enum ENUM_EXEC_MODE
{
   EXEC_MARKET = 0,              // ใช้ราคาตลาดปัจจุบัน (ค่าเริ่มต้นเดิม)
   EXEC_MATCH_MASTER,            // ส่ง Master Fill Price + tight deviation
   EXEC_LIMIT_CHASE              // ใช้ Limit Order ตามราคา Master แล้ว chase
};

//--- Connection State
enum ENUM_CONN_STATE
{
   CONN_DISCONNECTED = 0,
   CONN_CONNECTING,
   CONN_CONNECTED,
   CONN_AUTHENTICATED,
   CONN_ERROR
};

//--- Role
enum ENUM_CT_ROLE
{
   ROLE_MASTER = 0,
   ROLE_SLAVE
};

//+------------------------------------------------------------------+
//| Trade Signal Structure                                            |
//+------------------------------------------------------------------+
struct TradeSignal
{
   string            version;          // Protocol version
   string            masterID;         // Master identifier
   string            slaveID;          // Target slave (empty = all)
   ENUM_SIGNAL_TYPE  type;             // Signal type
   long              ticket;           // Master deal/order ticket
   long              positionID;       // Master position ID
   string            symbol;           // Trading symbol
   ENUM_ORDER_TYPE   orderType;        // BUY, SELL, LIMIT, STOP, etc.
   double            lots;             // Volume
   double            price;            // Open/Pending price
   double            fillPrice;        // ราคาที่ Master ได้ fill จริง
   double            sl;               // Stop Loss
   double            tp;               // Take Profit
   int               magic;            // Magic number
   string            comment;          // Order comment
   int               deviation;        // Max price deviation (points)
   double            closePercent;     // For partial close (0-100)
   datetime          timestamp;        // Signal creation time
   ulong             signalID;         // Unique signal ID
   ulong             fillTimeMs;       // เวลาที่ Master fill (ms) สำหรับวัด latency

   void Init()
   {
      version       = CT_VERSION;
      masterID      = "";
      slaveID       = "";
      type          = SIGNAL_OPEN;
      ticket        = 0;
      positionID    = 0;
      symbol        = "";
      orderType     = ORDER_TYPE_BUY;
      lots          = 0;
      price         = 0;
      fillPrice     = 0;
      sl            = 0;
      tp            = 0;
      magic         = CT_MAGIC_BASE;
      comment       = "";
      deviation     = 20;
      closePercent  = 0;
      timestamp     = TimeCurrent();
      signalID      = GetTickCount64();
      fillTimeMs    = GetTickCount64();
   }
};

//+------------------------------------------------------------------+
//| Ticket Mapping — Master ticket → Slave ticket                     |
//+------------------------------------------------------------------+
struct TicketMap
{
   long   masterTicket;
   long   slaveTicket;
   long   masterPositionID;
   long   slavePositionID;
   string symbol;
   double lots;
};

//+------------------------------------------------------------------+
//| Helper: Signal type to string                                     |
//+------------------------------------------------------------------+
string SignalTypeToString(ENUM_SIGNAL_TYPE type)
{
   switch(type)
   {
      case SIGNAL_OPEN:           return "OPEN";
      case SIGNAL_CLOSE:          return "CLOSE";
      case SIGNAL_MODIFY:         return "MODIFY";
      case SIGNAL_PARTIAL_CLOSE:  return "PARTIAL_CLOSE";
      case SIGNAL_PENDING_OPEN:   return "PENDING_OPEN";
      case SIGNAL_PENDING_MODIFY: return "PENDING_MODIFY";
      case SIGNAL_PENDING_DELETE: return "PENDING_DELETE";
      case SIGNAL_HEARTBEAT:      return "HEARTBEAT";
   }
   return "UNKNOWN";
}

//+------------------------------------------------------------------+
//| Helper: String to signal type                                     |
//+------------------------------------------------------------------+
ENUM_SIGNAL_TYPE StringToSignalType(string str)
{
   if(str == "OPEN")            return SIGNAL_OPEN;
   if(str == "CLOSE")           return SIGNAL_CLOSE;
   if(str == "MODIFY")          return SIGNAL_MODIFY;
   if(str == "PARTIAL_CLOSE")   return SIGNAL_PARTIAL_CLOSE;
   if(str == "PENDING_OPEN")    return SIGNAL_PENDING_OPEN;
   if(str == "PENDING_MODIFY")  return SIGNAL_PENDING_MODIFY;
   if(str == "PENDING_DELETE")  return SIGNAL_PENDING_DELETE;
   if(str == "HEARTBEAT")       return SIGNAL_HEARTBEAT;
   return SIGNAL_HEARTBEAT;
}

//+------------------------------------------------------------------+
//| Helper: Order type to string                                      |
//+------------------------------------------------------------------+
string OrderTypeToStr(ENUM_ORDER_TYPE type)
{
   switch(type)
   {
      case ORDER_TYPE_BUY:             return "BUY";
      case ORDER_TYPE_SELL:            return "SELL";
      case ORDER_TYPE_BUY_LIMIT:       return "BUY_LIMIT";
      case ORDER_TYPE_SELL_LIMIT:      return "SELL_LIMIT";
      case ORDER_TYPE_BUY_STOP:        return "BUY_STOP";
      case ORDER_TYPE_SELL_STOP:       return "SELL_STOP";
      case ORDER_TYPE_BUY_STOP_LIMIT:  return "BUY_STOP_LIMIT";
      case ORDER_TYPE_SELL_STOP_LIMIT: return "SELL_STOP_LIMIT";
   }
   return "BUY";
}

//+------------------------------------------------------------------+
//| Helper: String to order type                                      |
//+------------------------------------------------------------------+
ENUM_ORDER_TYPE StrToOrderType(string str)
{
   if(str == "BUY")              return ORDER_TYPE_BUY;
   if(str == "SELL")             return ORDER_TYPE_SELL;
   if(str == "BUY_LIMIT")       return ORDER_TYPE_BUY_LIMIT;
   if(str == "SELL_LIMIT")      return ORDER_TYPE_SELL_LIMIT;
   if(str == "BUY_STOP")        return ORDER_TYPE_BUY_STOP;
   if(str == "SELL_STOP")       return ORDER_TYPE_SELL_STOP;
   if(str == "BUY_STOP_LIMIT")  return ORDER_TYPE_BUY_STOP_LIMIT;
   if(str == "SELL_STOP_LIMIT") return ORDER_TYPE_SELL_STOP_LIMIT;
   return ORDER_TYPE_BUY;
}

//+------------------------------------------------------------------+
//| Log levels                                                        |
//+------------------------------------------------------------------+
enum ENUM_LOG_LEVEL
{
   LOG_DEBUG = 0,
   LOG_INFO,
   LOG_WARN,
   LOG_ERROR
};

void CTLog(ENUM_LOG_LEVEL level, string msg)
{
   string prefix = "";
   switch(level)
   {
      case LOG_DEBUG: prefix = "[CT-DEBUG] "; break;
      case LOG_INFO:  prefix = "[CT-INFO]  "; break;
      case LOG_WARN:  prefix = "[CT-WARN]  "; break;
      case LOG_ERROR: prefix = "[CT-ERROR] "; break;
   }
   Print(prefix, msg);
}

#endif // COPYTRADE_DEFINES_MQH
