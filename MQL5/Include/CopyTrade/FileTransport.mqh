//+------------------------------------------------------------------+
//|                                           FileTransport.mqh      |
//|                  File-based IPC for Local CopyTrade               |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.00"

#ifndef FILE_TRANSPORT_MQH
#define FILE_TRANSPORT_MQH

#include "CopyTradeDefines.mqh"
#include "JsonHelper.mqh"

//+------------------------------------------------------------------+
//| CFileTransport Class                                              |
//+------------------------------------------------------------------+
class CFileTransport
{
private:
   string            m_directory;
   string            m_masterID;
   ulong             m_lastReadSignalID;
   int               m_maxAge;

   string            GetSignalFilename(const TradeSignal &sig);
   bool              CreateDirectory();

public:
                     CFileTransport();
                    ~CFileTransport() {}

   //--- Setup
   void              SetMasterID(string id)  { m_masterID = id; }
   void              SetMaxAge(int sec)       { m_maxAge = sec; }
   bool              Init();

   //--- Master: Write signal
   bool              WriteSignal(const TradeSignal &sig);

   //--- Slave: Read signals
   int               ReadSignals(TradeSignal &signals[]);

   //--- Cleanup old signal files
   void              Cleanup();
};

//+------------------------------------------------------------------+
//| Constructor                                                       |
//+------------------------------------------------------------------+
CFileTransport::CFileTransport()
{
   m_directory         = CT_FILE_DIR;
   m_masterID          = "";
   m_lastReadSignalID  = 0;
   m_maxAge            = CT_FILE_MAX_AGE_SEC;
}

//+------------------------------------------------------------------+
//| Initialize transport                                              |
//+------------------------------------------------------------------+
bool CFileTransport::Init()
{
   return CreateDirectory();
}

//+------------------------------------------------------------------+
//| Create shared directory                                           |
//+------------------------------------------------------------------+
bool CFileTransport::CreateDirectory()
{
   if(!FolderCreate(m_directory))
   {
      // Folder might already exist, that's OK
      int err = GetLastError();
      if(err != 5020) // Already exists
         CTLog(LOG_WARN, "FolderCreate: " + IntegerToString(err));
   }
   return true;
}

//+------------------------------------------------------------------+
//| Generate signal filename                                          |
//+------------------------------------------------------------------+
string CFileTransport::GetSignalFilename(const TradeSignal &sig)
{
   return m_directory + CT_SIGNAL_PREFIX +
          sig.masterID + "_" +
          IntegerToString((long)sig.signalID) +
          CT_SIGNAL_EXT;
}

//+------------------------------------------------------------------+
//| Master: Write signal to file                                      |
//+------------------------------------------------------------------+
bool CFileTransport::WriteSignal(const TradeSignal &sig)
{
   string filename = GetSignalFilename(sig);
   string json = SignalToJson(sig);

   int handle = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(handle == INVALID_HANDLE)
   {
      // Fallback: Try without FILE_COMMON
      handle = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI);
      if(handle == INVALID_HANDLE)
      {
         CTLog(LOG_ERROR, "WriteSignal: Cannot open file " + filename +
               " Error: " + IntegerToString(GetLastError()));
         return false;
      }
   }

   FileWriteString(handle, json);
   FileClose(handle);

   CTLog(LOG_DEBUG, "Signal written: " + filename);
   return true;
}

//+------------------------------------------------------------------+
//| Slave: Read all pending signal files                              |
//+------------------------------------------------------------------+
int CFileTransport::ReadSignals(TradeSignal &signals[])
{
   ArrayResize(signals, 0);
   int count = 0;

   // Search for signal files
   string filter = m_directory + CT_SIGNAL_PREFIX + "*" + CT_SIGNAL_EXT;
   string filename;
   long searchHandle = FileFindFirst(filter, filename);

   if(searchHandle == INVALID_HANDLE)
   {
      // Try with FILE_COMMON
      filter = CT_SIGNAL_PREFIX + "*" + CT_SIGNAL_EXT;
      searchHandle = FileFindFirst(filter, filename, FILE_COMMON);
      if(searchHandle == INVALID_HANDLE)
         return 0;
   }

   do
   {
      string filepath = m_directory + filename;

      // Try to open and read
      int handle = FileOpen(filepath, FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON);
      if(handle == INVALID_HANDLE)
         handle = FileOpen(filepath, FILE_READ | FILE_TXT | FILE_ANSI);

      if(handle == INVALID_HANDLE)
         continue;

      string json = "";
      while(!FileIsEnding(handle))
         json += FileReadString(handle);
      FileClose(handle);

      // Parse signal
      TradeSignal sig;
      if(JsonToSignal(json, sig))
      {
         // Skip already processed signals
         if(sig.signalID > m_lastReadSignalID && sig.type != SIGNAL_HEARTBEAT)
         {
            count++;
            ArrayResize(signals, count);
            signals[count - 1] = sig;
            m_lastReadSignalID = sig.signalID;
         }
      }

      // Delete processed file
      FileDelete(filepath, FILE_COMMON);
      FileDelete(filepath);

   } while(FileFindNext(searchHandle, filename));

   FileFindClose(searchHandle);

   if(count > 0)
      CTLog(LOG_DEBUG, "Read " + IntegerToString(count) + " signal(s) from files");

   return count;
}

//+------------------------------------------------------------------+
//| Cleanup: Delete old signal files                                  |
//+------------------------------------------------------------------+
void CFileTransport::Cleanup()
{
   string filter = CT_SIGNAL_PREFIX + "*" + CT_SIGNAL_EXT;
   string filename;
   long searchHandle = FileFindFirst(filter, filename, FILE_COMMON);

   if(searchHandle == INVALID_HANDLE) return;

   datetime now = TimeCurrent();
   do
   {
      string filepath = m_directory + filename;
      // Check file age based on filename timestamp
      // Delete if too old
      int handle = FileOpen(filepath, FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON);
      if(handle != INVALID_HANDLE)
      {
         string json = FileReadString(handle);
         FileClose(handle);

         TradeSignal sig;
         if(JsonToSignal(json, sig))
         {
            if((long)(now - sig.timestamp) > m_maxAge)
            {
               FileDelete(filepath, FILE_COMMON);
               FileDelete(filepath);
            }
         }
      }
   } while(FileFindNext(searchHandle, filename));

   FileFindClose(searchHandle);
}

#endif // FILE_TRANSPORT_MQH
