//+------------------------------------------------------------------+
//|                                          SocketTransport.mqh     |
//|                TCP Socket Transport for Remote CopyTrade          |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.00"

#ifndef SOCKET_TRANSPORT_MQH
#define SOCKET_TRANSPORT_MQH

#include "CopyTradeDefines.mqh"
#include "JsonHelper.mqh"

//+------------------------------------------------------------------+
//| CSocketTransport Class                                            |
//+------------------------------------------------------------------+
class CSocketTransport
{
private:
   int               m_socket;
   string            m_host;
   int               m_port;
   string            m_token;
   string            m_id;
   ENUM_CT_ROLE      m_role;
   ENUM_CONN_STATE   m_state;
   datetime          m_lastHeartbeat;
   datetime          m_lastReconnect;
   int               m_reconnectSec;
   uchar             m_recvBuffer[];

   bool              DoConnect();
   bool              Authenticate();
   bool              SendRaw(string data);
   string            ReceiveRaw();

public:
                     CSocketTransport();
                    ~CSocketTransport();

   //--- Setup
   void              SetHost(string host)     { m_host = host; }
   void              SetPort(int port)        { m_port = port; }
   void              SetToken(string token)   { m_token = token; }
   void              SetID(string id)         { m_id = id; }
   void              SetRole(ENUM_CT_ROLE r)  { m_role = r; }

   //--- Connection
   bool              Connect();
   void              Disconnect();
   bool              IsConnected()            { return m_state == CONN_AUTHENTICATED; }
   ENUM_CONN_STATE   GetState()               { return m_state; }
   bool              TryReconnect();

   //--- Send/Receive
   bool              SendSignal(const TradeSignal &sig);
   bool              SendMessage(string json);
   int               ReceiveSignals(TradeSignal &signals[]);
   bool              SendHeartbeat();
   bool              Subscribe(string masterID);

   //--- Process
   void              ProcessIncoming(TradeSignal &signals[], int &count);
};

//+------------------------------------------------------------------+
//| Constructor                                                       |
//+------------------------------------------------------------------+
CSocketTransport::CSocketTransport()
{
   m_socket         = INVALID_HANDLE;
   m_host           = "127.0.0.1";
   m_port           = 5555;
   m_token          = "";
   m_id             = "";
   m_role           = ROLE_SLAVE;
   m_state          = CONN_DISCONNECTED;
   m_lastHeartbeat  = 0;
   m_lastReconnect  = 0;
   m_reconnectSec   = CT_RECONNECT_SEC;
   ArrayResize(m_recvBuffer, 0);
}

//+------------------------------------------------------------------+
//| Destructor                                                        |
//+------------------------------------------------------------------+
CSocketTransport::~CSocketTransport()
{
   Disconnect();
}

//+------------------------------------------------------------------+
//| Connect to relay server                                           |
//+------------------------------------------------------------------+
bool CSocketTransport::Connect()
{
   if(m_state == CONN_AUTHENTICATED)
      return true;

   if(!DoConnect())
      return false;

   if(!Authenticate())
   {
      Disconnect();
      return false;
   }

   m_state = CONN_AUTHENTICATED;
   m_lastHeartbeat = TimeCurrent();
   CTLog(LOG_INFO, "🔗 Connected to Relay Server " + m_host + ":" + IntegerToString(m_port));
   return true;
}

//+------------------------------------------------------------------+
//| Internal TCP connect                                              |
//+------------------------------------------------------------------+
bool CSocketTransport::DoConnect()
{
   m_state = CONN_CONNECTING;

   m_socket = SocketCreate();
   if(m_socket == INVALID_HANDLE)
   {
      CTLog(LOG_ERROR, "SocketCreate failed: " + IntegerToString(GetLastError()));
      m_state = CONN_ERROR;
      return false;
   }

   if(!SocketConnect(m_socket, m_host, m_port, CT_SOCKET_TIMEOUT))
   {
      CTLog(LOG_ERROR, "SocketConnect failed to " + m_host + ":" + IntegerToString(m_port) +
            " Error: " + IntegerToString(GetLastError()));
      SocketClose(m_socket);
      m_socket = INVALID_HANDLE;
      m_state = CONN_ERROR;
      return false;
   }

   m_state = CONN_CONNECTED;
   return true;
}

//+------------------------------------------------------------------+
//| Authenticate with relay server                                    |
//+------------------------------------------------------------------+
bool CSocketTransport::Authenticate()
{
   string roleStr = (m_role == ROLE_MASTER) ? "master" : "slave";
   string authJson = CreateAuthJson(roleStr, m_id, m_token);
   return SendMessage(authJson);
}

//+------------------------------------------------------------------+
//| Disconnect from server                                            |
//+------------------------------------------------------------------+
void CSocketTransport::Disconnect()
{
   if(m_socket != INVALID_HANDLE)
   {
      SocketClose(m_socket);
      m_socket = INVALID_HANDLE;
   }
   m_state = CONN_DISCONNECTED;
}

//+------------------------------------------------------------------+
//| Try reconnect if disconnected                                     |
//+------------------------------------------------------------------+
bool CSocketTransport::TryReconnect()
{
   if(m_state == CONN_AUTHENTICATED)
      return true;

   datetime now = TimeCurrent();
   if(now - m_lastReconnect < m_reconnectSec)
      return false;

   m_lastReconnect = now;
   CTLog(LOG_INFO, "🔄 Attempting reconnect...");
   Disconnect();
   return Connect();
}

//+------------------------------------------------------------------+
//| Send length-prefixed message                                      |
//+------------------------------------------------------------------+
bool CSocketTransport::SendMessage(string json)
{
   if(m_socket == INVALID_HANDLE)
      return false;

   // Create message: 4-byte length header + JSON body
   uchar jsonBytes[];
   int jsonLen = StringToCharArray(json, jsonBytes, 0, WHOLE_ARRAY, CP_UTF8) - 1; // exclude null
   if(jsonLen <= 0) return false;

   // Build packet: [4-byte length][JSON data]
   uchar packet[];
   ArrayResize(packet, 4 + jsonLen);

   // Length header (big-endian)
   packet[0] = (uchar)((jsonLen >> 24) & 0xFF);
   packet[1] = (uchar)((jsonLen >> 16) & 0xFF);
   packet[2] = (uchar)((jsonLen >> 8) & 0xFF);
   packet[3] = (uchar)(jsonLen & 0xFF);

   // Copy JSON data
   for(int i = 0; i < jsonLen; i++)
      packet[4 + i] = jsonBytes[i];

   int sent = SocketSend(m_socket, packet, ArraySize(packet));
   if(sent <= 0)
   {
      CTLog(LOG_ERROR, "SocketSend failed: " + IntegerToString(GetLastError()));
      m_state = CONN_ERROR;
      return false;
   }

   return true;
}

//+------------------------------------------------------------------+
//| Send trade signal                                                 |
//+------------------------------------------------------------------+
bool CSocketTransport::SendSignal(const TradeSignal &sig)
{
   string json = SignalToJson(sig);
   string wrapped = WrapSignalJson(json);
   return SendMessage(wrapped);
}

//+------------------------------------------------------------------+
//| Receive raw data from socket                                      |
//+------------------------------------------------------------------+
string CSocketTransport::ReceiveRaw()
{
   if(m_socket == INVALID_HANDLE) return "";

   uint available = SocketIsReadable(m_socket);
   if(available == 0) return "";

   uchar buffer[];
   if(available > CT_MAX_MSG_SIZE) available = CT_MAX_MSG_SIZE;
   ArrayResize(buffer, available);

   // Non-blocking read with short timeout
   uint bytesRead = SocketRead(m_socket, buffer, available, 50);
   if(bytesRead <= 0) return "";

   string data = CharArrayToString(buffer, 0, bytesRead, CP_UTF8);
   return data;
}

//+------------------------------------------------------------------+
//| Receive and parse signals                                         |
//+------------------------------------------------------------------+
int CSocketTransport::ReceiveSignals(TradeSignal &signals[])
{
   ArrayResize(signals, 0);
   int count = 0;

   if(m_socket == INVALID_HANDLE || m_state != CONN_AUTHENTICATED)
      return 0;

   uint available = SocketIsReadable(m_socket);
   if(available > 0)
   {
      // Read available data
      uchar buffer[];
      if(available > CT_MAX_MSG_SIZE) available = CT_MAX_MSG_SIZE;
      ArrayResize(buffer, available);
      
      uint bytesRead = SocketRead(m_socket, buffer, available, 50);
      if(bytesRead > 0)
      {
         // Append to recv buffer
         int oldSize = ArraySize(m_recvBuffer);
         ArrayResize(m_recvBuffer, oldSize + bytesRead);
         ArrayCopy(m_recvBuffer, buffer, oldSize, 0, bytesRead);
      }
   }

   // Parse complete messages from buffer
   while(ArraySize(m_recvBuffer) >= 4)
   {
      int msgLen = (m_recvBuffer[0] << 24) | (m_recvBuffer[1] << 16) |
                   (m_recvBuffer[2] << 8) | m_recvBuffer[3];

      if(msgLen <= 0 || msgLen > CT_MAX_MSG_SIZE)
      {
         // Invalid header — drop 1 byte and scan again
         ArrayCopy(m_recvBuffer, m_recvBuffer, 0, 1);
         ArrayResize(m_recvBuffer, ArraySize(m_recvBuffer) - 1);
         continue;
      }

      // Check if we have complete message
      if(ArraySize(m_recvBuffer) < 4 + msgLen)
         break; // Wait for more data

      // Extract JSON
      string json = CharArrayToString(m_recvBuffer, 4, msgLen, CP_UTF8);

      // Shift buffer
      int remaining = ArraySize(m_recvBuffer) - (4 + msgLen);
      if(remaining > 0)
         ArrayCopy(m_recvBuffer, m_recvBuffer, 0, 4 + msgLen, remaining);
      ArrayResize(m_recvBuffer, remaining);

      // Check action type
      string action = GetJsonAction(json);

      if(action == "signal")
      {
         TradeSignal sig;
         if(JsonToSignal(json, sig))
         {
            count++;
            ArrayResize(signals, count);
            signals[count - 1] = sig;
         }
      }
      else if(action == "heartbeat")
      {
         m_lastHeartbeat = TimeCurrent();
      }
      else if(action == "auth_ok")
      {
         CTLog(LOG_INFO, "✅ Authenticated with relay server");
      }
   }

   return count;
}

//+------------------------------------------------------------------+
//| Send heartbeat                                                    |
//+------------------------------------------------------------------+
bool CSocketTransport::SendHeartbeat()
{
   datetime now = TimeCurrent();
   if(now - m_lastHeartbeat < CT_HEARTBEAT_SEC)
      return true;

   m_lastHeartbeat = now;
   string roleStr = (m_role == ROLE_MASTER) ? "master" : "slave";
   string json = CreateHeartbeatJson(m_id, roleStr);
   return SendMessage(json);
}

//+------------------------------------------------------------------+
//| Subscribe slave to master                                         |
//+------------------------------------------------------------------+
bool CSocketTransport::Subscribe(string masterID)
{
   string json = CreateSubscribeJson(m_id, masterID);
   return SendMessage(json);
}

#endif // SOCKET_TRANSPORT_MQH
