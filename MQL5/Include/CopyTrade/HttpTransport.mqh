//+------------------------------------------------------------------+
//|                                           HttpTransport.mqh     |
//|               HTTP Transport for Cloud/Serverless CopyTrade      |
//|               Uses WebRequest — deployable on Render/Vercel      |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "2.00"

#ifndef HTTP_TRANSPORT_MQH
#define HTTP_TRANSPORT_MQH

#include "CopyTradeDefines.mqh"
#include "JsonHelper.mqh"

//+------------------------------------------------------------------+
//| CHttpTransport Class                                              |
//| ★ IMPORTANT: ต้องเพิ่ม URL ใน MT5 Settings:                       |
//|   Tools → Options → Expert Advisors → Allow WebRequest for:       |
//|   https://your-server.onrender.com                                |
//+------------------------------------------------------------------+
class CHttpTransport
{
private:
   string            m_baseURL;       // e.g. "https://your-server.onrender.com"
   string            m_token;
   string            m_id;
   ENUM_CT_ROLE      m_role;
   bool              m_authenticated;
   datetime          m_lastHeartbeat;
   int               m_timeout;       // HTTP timeout (ms)
   string            m_subscribedTo;  // master ID for slave

   // Internal HTTP helper
   int               HttpRequest(string method, string endpoint, string body,
                                 string &responseBody, string &responseHeaders);
   string            BuildHeaders();

public:
                     CHttpTransport();
                    ~CHttpTransport();

   //--- Setup (same interface as CSocketTransport)
   void              SetHost(string url)     { m_baseURL = url; }
   void              SetPort(int port)       { /* unused for HTTP — port is in URL */ }
   void              SetToken(string token)  { m_token = token; }
   void              SetID(string id)        { m_id = id; }
   void              SetRole(ENUM_CT_ROLE r) { m_role = r; }

   //--- Connection
   bool              Connect();
   void              Disconnect();
   bool              IsConnected()           { return m_authenticated; }
   ENUM_CONN_STATE   GetState()              { return m_authenticated ? CONN_AUTHENTICATED : CONN_DISCONNECTED; }
   bool              TryReconnect();

   //--- Send/Receive
   bool              SendSignal(const TradeSignal &sig);
   bool              SendMessage(string json);
   int               ReceiveSignals(TradeSignal &signals[]);
   bool              SendHeartbeat();
   bool              Subscribe(string masterID);
};

//+------------------------------------------------------------------+
//| Constructor                                                       |
//+------------------------------------------------------------------+
CHttpTransport::CHttpTransport()
{
   m_baseURL        = "";
   m_token          = "";
   m_id             = "";
   m_role           = ROLE_SLAVE;
   m_authenticated  = false;
   m_lastHeartbeat  = 0;
   m_timeout        = 5000;
   m_subscribedTo   = "";
}

//+------------------------------------------------------------------+
//| Destructor                                                        |
//+------------------------------------------------------------------+
CHttpTransport::~CHttpTransport()
{
   Disconnect();
}

//+------------------------------------------------------------------+
//| Build authorization headers                                       |
//+------------------------------------------------------------------+
string CHttpTransport::BuildHeaders()
{
   string headers = "Content-Type: application/json\r\n";
   if(m_token != "")
      headers += "Authorization: Bearer " + m_token + "\r\n";
   return headers;
}

//+------------------------------------------------------------------+
//| Send HTTP request and get response                                |
//+------------------------------------------------------------------+
int CHttpTransport::HttpRequest(string method, string endpoint, string body,
                                string &responseBody, string &responseHeaders)
{
   string url = m_baseURL + endpoint;

   // Prepare request body
   char bodyData[];
   if(body != "" && body != NULL)
   {
      int len = StringToCharArray(body, bodyData, 0, WHOLE_ARRAY, CP_UTF8) - 1;
      if(len > 0)
         ArrayResize(bodyData, len); // remove null terminator
      else
         ArrayResize(bodyData, 0);
   }

   // Prepare response buffers
   char result[];
   string resHeaders;

   // Send request
   ResetLastError();
   int status = WebRequest(method, url, BuildHeaders(), m_timeout, bodyData, result, resHeaders);

   responseHeaders = resHeaders;

   if(status == -1)
   {
      int err = GetLastError();
      if(err == 4014)
         CTLog(LOG_ERROR, "⚠️ WebRequest ถูกบล็อก! ต้องเพิ่ม URL ใน MT5: Tools → Options → Expert Advisors → Allow WebRequest for: " + m_baseURL);
      else
         CTLog(LOG_ERROR, "HTTP request failed: error " + IntegerToString(err));
      return -1;
   }

   // Parse response body
   if(ArraySize(result) > 0)
      responseBody = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   else
      responseBody = "";

   return status;
}

//+------------------------------------------------------------------+
//| Connect (authenticate with server)                                |
//+------------------------------------------------------------------+
bool CHttpTransport::Connect()
{
   if(m_authenticated)
      return true;

   if(m_baseURL == "")
   {
      CTLog(LOG_ERROR, "HTTP Transport: base URL not set");
      return false;
   }

   // Remove trailing slash
   if(StringSubstr(m_baseURL, StringLen(m_baseURL) - 1, 1) == "/")
      m_baseURL = StringSubstr(m_baseURL, 0, StringLen(m_baseURL) - 1);

   string roleStr = (m_role == ROLE_MASTER) ? "master" : "slave";
   string body = "{\"role\":\"" + roleStr + "\",\"id\":\"" + m_id + "\",\"token\":\"" + m_token + "\"}";

   string response, headers;
   int status = HttpRequest("POST", "/api/ea/auth", body, response, headers);

   if(status == 200)
   {
      m_authenticated = true;
      m_lastHeartbeat = TimeCurrent();
      CTLog(LOG_INFO, "🌐 Connected to Relay Server via HTTP: " + m_baseURL);
      return true;
   }

   CTLog(LOG_ERROR, "HTTP Auth failed (status " + IntegerToString(status) + "): " + response);
   return false;
}

//+------------------------------------------------------------------+
//| Disconnect                                                        |
//+------------------------------------------------------------------+
void CHttpTransport::Disconnect()
{
   m_authenticated = false;
}

//+------------------------------------------------------------------+
//| Try reconnect                                                     |
//+------------------------------------------------------------------+
bool CHttpTransport::TryReconnect()
{
   if(m_authenticated)
      return true;

   static datetime s_lastReconnect = 0;
   datetime now = TimeCurrent();
   if(now - s_lastReconnect < CT_RECONNECT_SEC)
      return false;

   s_lastReconnect = now;
   CTLog(LOG_INFO, "🔄 HTTP reconnecting...");
   m_authenticated = false;
   return Connect();
}

//+------------------------------------------------------------------+
//| Send trade signal via HTTP POST                                   |
//+------------------------------------------------------------------+
bool CHttpTransport::SendSignal(const TradeSignal &sig)
{
   if(!m_authenticated) return false;

   string json = SignalToJson(sig);
   // Wrap with action header (same as TCP protocol)
   string wrapped = "{\"action\":\"signal\"," + StringSubstr(json, 1);

   string response, headers;
   int status = HttpRequest("POST", "/api/ea/signal", wrapped, response, headers);

   if(status == 200) return true;

   if(status == 401)
   {
      CTLog(LOG_WARN, "HTTP auth expired, reconnecting...");
      m_authenticated = false;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Send raw JSON (compatibility with SocketTransport interface)      |
//+------------------------------------------------------------------+
bool CHttpTransport::SendMessage(string json)
{
   // Route to appropriate endpoint based on action
   string action = JsonGetString(json, "action");
   string response, headers;

   if(action == "heartbeat")
      return SendHeartbeat();
   if(action == "subscribe")
   {
      int status = HttpRequest("POST", "/api/ea/subscribe", json, response, headers);
      return (status == 200);
   }

   // Generic POST
   int status = HttpRequest("POST", "/api/ea/signal", json, response, headers);
   return (status == 200);
}

//+------------------------------------------------------------------+
//| Receive signals via HTTP poll (Slave only)                        |
//+------------------------------------------------------------------+
int CHttpTransport::ReceiveSignals(TradeSignal &signals[])
{
   ArrayResize(signals, 0);
   if(!m_authenticated) return 0;

   // Poll endpoint
   string endpoint = "/api/ea/poll?id=" + m_id;

   string response, headers;
   int status = HttpRequest("GET", endpoint, "", response, headers);

   if(status != 200)
   {
      if(status == 401) m_authenticated = false;
      return 0;
   }

   if(response == "" || StringLen(response) < 10) return 0;

   // Parse response: {"ok":true,"signals":[{...},{...}],"count":N,"lastSeq":M}
   // Extract the signals array
   int arrStart = StringFind(response, "\"signals\":[");
   if(arrStart < 0) return 0;

   arrStart = StringFind(response, "[", arrStart);
   if(arrStart < 0) return 0;

   // Find matching closing bracket
   int depth = 0;
   int arrEnd = -1;
   int len = StringLen(response);
   for(int i = arrStart; i < len; i++)
   {
      string ch = StringSubstr(response, i, 1);
      if(ch == "[") depth++;
      else if(ch == "]") { depth--; if(depth == 0) { arrEnd = i; break; } }
   }
   if(arrEnd < 0) return 0;

   // Extract individual signal objects from array
   string arrContent = StringSubstr(response, arrStart + 1, arrEnd - arrStart - 1);
   if(StringLen(arrContent) < 5) return 0;

   int count = 0;
   int pos = 0;
   int contentLen = StringLen(arrContent);

   while(pos < contentLen)
   {
      int objStart = StringFind(arrContent, "{", pos);
      if(objStart < 0) break;

      // Find matching closing brace
      int objDepth = 0;
      int objEnd = -1;
      for(int i = objStart; i < contentLen; i++)
      {
         string ch = StringSubstr(arrContent, i, 1);
         if(ch == "{") objDepth++;
         else if(ch == "}")
         {
            objDepth--;
            if(objDepth == 0) { objEnd = i; break; }
         }
      }
      if(objEnd < 0) break;

      string objStr = StringSubstr(arrContent, objStart, objEnd - objStart + 1);

      TradeSignal sig;
      if(JsonToSignal(objStr, sig))
      {
         count++;
         ArrayResize(signals, count);
         signals[count - 1] = sig;
      }

      pos = objEnd + 1;
   }

   if(count > 0)
      CTLog(LOG_INFO, "📥 HTTP Poll: received " + IntegerToString(count) + " signal(s)");

   return count;
}

//+------------------------------------------------------------------+
//| Send heartbeat via HTTP POST                                      |
//+------------------------------------------------------------------+
bool CHttpTransport::SendHeartbeat()
{
   datetime now = TimeCurrent();
   if(now - m_lastHeartbeat < CT_HEARTBEAT_SEC)
      return true;

   if(!m_authenticated) return false;

   m_lastHeartbeat = now;
   string roleStr = (m_role == ROLE_MASTER) ? "master" : "slave";
   string json = CreateHeartbeatJson(m_id, roleStr);

   string response, headers;
   int status = HttpRequest("POST", "/api/ea/heartbeat", json, response, headers);

   if(status == 200) return true;

   if(status == 401)
   {
      CTLog(LOG_WARN, "HTTP heartbeat auth failed, reconnecting...");
      m_authenticated = false;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Subscribe slave to master via HTTP POST                           |
//+------------------------------------------------------------------+
bool CHttpTransport::Subscribe(string masterID)
{
   if(!m_authenticated) return false;

   m_subscribedTo = masterID;
   string json = CreateSubscribeJson(m_id, masterID);

   string response, headers;
   int status = HttpRequest("POST", "/api/ea/subscribe", json, response, headers);

   if(status == 200)
   {
      CTLog(LOG_INFO, "✅ HTTP Subscribed to Master: " + masterID);
      return true;
   }
   return false;
}

#endif // HTTP_TRANSPORT_MQH
