//+------------------------------------------------------------------+
//|                                               JsonHelper.mqh     |
//|                     JSON Serializer/Deserializer for TradeSignal  |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.00"

#ifndef JSON_HELPER_MQH
#define JSON_HELPER_MQH

#include "CopyTradeDefines.mqh"

//+------------------------------------------------------------------+
//| Serialize TradeSignal → JSON string                               |
//+------------------------------------------------------------------+
string SignalToJson(const TradeSignal &sig)
{
   string json = "{";
   json += "\"v\":\"" + sig.version + "\",";
   json += "\"mid\":\"" + sig.masterID + "\",";
   json += "\"sid\":\"" + sig.slaveID + "\",";
   json += "\"type\":\"" + SignalTypeToString(sig.type) + "\",";
   json += "\"ticket\":" + IntegerToString(sig.ticket) + ",";
   json += "\"posID\":" + IntegerToString(sig.positionID) + ",";
   json += "\"sym\":\"" + sig.symbol + "\",";
   json += "\"ot\":\"" + OrderTypeToStr(sig.orderType) + "\",";
   json += "\"lots\":" + DoubleToString(sig.lots, 4) + ",";
   json += "\"price\":" + DoubleToString(sig.price, 8) + ",";
   json += "\"fp\":" + DoubleToString(sig.fillPrice, 8) + ",";
   json += "\"sl\":" + DoubleToString(sig.sl, 8) + ",";
   json += "\"tp\":" + DoubleToString(sig.tp, 8) + ",";
   json += "\"magic\":" + IntegerToString(sig.magic) + ",";
   json += "\"cmt\":\"" + sig.comment + "\",";
   json += "\"dev\":" + IntegerToString(sig.deviation) + ",";
   json += "\"cp\":" + DoubleToString(sig.closePercent, 2) + ",";
   json += "\"ts\":" + IntegerToString((long)sig.timestamp) + ",";
   json += "\"sigID\":" + IntegerToString((long)sig.signalID) + ",";
   json += "\"ftMs\":" + IntegerToString((long)sig.fillTimeMs);
   json += "}";
   return json;
}

//+------------------------------------------------------------------+
//| Deserialize JSON string → TradeSignal                             |
//+------------------------------------------------------------------+
bool JsonToSignal(string json, TradeSignal &sig)
{
   sig.Init();

   // Remove whitespace
   StringReplace(json, "\r", "");
   StringReplace(json, "\n", "");
   StringReplace(json, "\t", "");

   sig.version      = JsonGetString(json, "v");
   sig.masterID     = JsonGetString(json, "mid");
   sig.slaveID      = JsonGetString(json, "sid");
   sig.type         = StringToSignalType(JsonGetString(json, "type"));
   sig.ticket       = (long)JsonGetInt(json, "ticket");
   sig.positionID    = (long)JsonGetInt(json, "posID");
   sig.symbol       = JsonGetString(json, "sym");
   sig.orderType    = StrToOrderType(JsonGetString(json, "ot"));
   sig.lots         = JsonGetDouble(json, "lots");
   sig.price        = JsonGetDouble(json, "price");
   sig.fillPrice    = JsonGetDouble(json, "fp");
   sig.sl           = JsonGetDouble(json, "sl");
   sig.tp           = JsonGetDouble(json, "tp");
   sig.magic        = (int)JsonGetInt(json, "magic");
   sig.comment      = JsonGetString(json, "cmt");
   sig.deviation    = (int)JsonGetInt(json, "dev");
   sig.closePercent = JsonGetDouble(json, "cp");
   sig.timestamp    = (datetime)JsonGetInt(json, "ts");
   sig.signalID     = (ulong)JsonGetInt(json, "sigID");
   sig.fillTimeMs   = (ulong)JsonGetInt(json, "ftMs");

   return (sig.version != "" && sig.masterID != "");
}

//+------------------------------------------------------------------+
//| Get string value from JSON by key                                 |
//+------------------------------------------------------------------+
string JsonGetString(const string &json, const string key)
{
   string search = "\"" + key + "\":\"";
   int pos = StringFind(json, search);
   if(pos < 0) return "";

   int start = pos + StringLen(search);
   int end = StringFind(json, "\"", start);
   if(end < 0) return "";

   return StringSubstr(json, start, end - start);
}

//+------------------------------------------------------------------+
//| Get double value from JSON by key                                 |
//+------------------------------------------------------------------+
double JsonGetDouble(const string &json, const string key)
{
   string val = JsonGetRawValue(json, key);
   if(val == "") return 0;
   return StringToDouble(val);
}

//+------------------------------------------------------------------+
//| Get integer value from JSON by key                                |
//+------------------------------------------------------------------+
long JsonGetInt(const string &json, const string key)
{
   string val = JsonGetRawValue(json, key);
   if(val == "") return 0;
   return StringToInteger(val);
}

//+------------------------------------------------------------------+
//| Get raw value (number/bool) from JSON by key                      |
//+------------------------------------------------------------------+
string JsonGetRawValue(const string &json, const string key)
{
   // Try number format: "key":123
   string search = "\"" + key + "\":";
   int pos = StringFind(json, search);
   if(pos < 0) return "";

   int start = pos + StringLen(search);
   // Check if it's a string (starts with quote)
   string firstChar = StringSubstr(json, start, 1);
   if(firstChar == "\"") return ""; // It's a string, not a number

   // Find end: comma, closing brace, or end of string
   int end = start;
   int len = StringLen(json);
   while(end < len)
   {
      string ch = StringSubstr(json, end, 1);
      if(ch == "," || ch == "}" || ch == "]" || ch == " ")
         break;
      end++;
   }

   return StringSubstr(json, start, end - start);
}

//+------------------------------------------------------------------+
//| Create authentication JSON                                        |
//+------------------------------------------------------------------+
string CreateAuthJson(string role, string id, string token)
{
   string json = "{";
   json += "\"action\":\"auth\",";
   json += "\"role\":\"" + role + "\",";
   json += "\"id\":\"" + id + "\",";
   json += "\"token\":\"" + token + "\"";
   json += "}";
   return json;
}

//+------------------------------------------------------------------+
//| Create heartbeat JSON (Enriched with Financial Metrics)           |
//+------------------------------------------------------------------+
string CreateHeartbeatJson(string id, string role)
{
   double balance     = AccountInfoDouble(ACCOUNT_BALANCE);
   double equity      = AccountInfoDouble(ACCOUNT_EQUITY);
   double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
   double profit      = AccountInfoDouble(ACCOUNT_PROFIT);
   int    positions   = PositionsTotal();
   double cumDW       = GetCumulativeDW();

   string json = "{";
   json += "\"action\":\"heartbeat\",";
   json += "\"id\":\"" + id + "\",";
   json += "\"role\":\"" + role + "\",";
   json += "\"balance\":" + DoubleToString(balance, 2) + ",";
   json += "\"equity\":" + DoubleToString(equity, 2) + ",";
   json += "\"marginLevel\":" + DoubleToString(marginLevel, 2) + ",";
   json += "\"floatingPnL\":" + DoubleToString(profit, 2) + ",";
   json += "\"positions\":" + IntegerToString(positions) + ",";
   json += "\"cumulativeDW\":" + DoubleToString(cumDW, 2) + ",";
   json += "\"ts\":" + IntegerToString((long)TimeCurrent());
   json += "}";
   return json;
}

//+------------------------------------------------------------------+
//| Create subscribe JSON (slave subscribes to master)                |
//+------------------------------------------------------------------+
string CreateSubscribeJson(string slaveID, string masterID)
{
   string json = "{";
   json += "\"action\":\"subscribe\",";
   json += "\"slaveID\":\"" + slaveID + "\",";
   json += "\"masterID\":\"" + masterID + "\"";
   json += "}";
   return json;
}

//+------------------------------------------------------------------+
//| Wrap signal JSON for socket transport (with action header)        |
//+------------------------------------------------------------------+
string WrapSignalJson(const string &signalJson)
{
   // Insert action field at the beginning
   string wrapped = "{\"action\":\"signal\"," + StringSubstr(signalJson, 1);
   return wrapped;
}

//+------------------------------------------------------------------+
//| Check if JSON has specific action                                 |
//+------------------------------------------------------------------+
string GetJsonAction(const string &json)
{
   return JsonGetString(json, "action");
}

//+------------------------------------------------------------------+
//| Extract signal JSON from wrapped message                          |
//+------------------------------------------------------------------+
string UnwrapSignalJson(const string &json)
{
   // Remove the "action":"signal", part and reconstruct
   return json; // Signal fields are already embedded
}

//+------------------------------------------------------------------+
//| Calculate Cumulative Deposit/Withdrawal                           |
//+------------------------------------------------------------------+
double GetCumulativeDW()
{
   static double cached_dw = 0.0;
   static datetime last_check = 0;
   datetime now = TimeCurrent();
   
   // Update at most every 5 seconds
   if(now - last_check >= 5)
   {
      // Use now + 86400 to ensure all latest deals are captured reliably
      if(HistorySelect(0, now + 864000))
      {
         int total = HistoryDealsTotal();
         double dw = 0.0;
         for(int i = 0; i < total; i++)
         {
            ulong ticket = HistoryDealGetTicket(i);
            ENUM_DEAL_TYPE type = (ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket, DEAL_TYPE);
            if(type == DEAL_TYPE_BALANCE || type == DEAL_TYPE_CREDIT || type == DEAL_TYPE_BONUS || type == DEAL_TYPE_CHARGE || type == DEAL_TYPE_CORRECTION)
            {
               dw += HistoryDealGetDouble(ticket, DEAL_PROFIT);
            }
         }
         cached_dw = dw;
         last_check = now;
      }
   }
   return cached_dw;
}

#endif // JSON_HELPER_MQH
