//+------------------------------------------------------------------+
//|                                           FileTransport.mqh      |
//|                  File-based IPC for Local CopyTrade               |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.02"

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
   int               m_maxAge;

   //--- ★ FIX: ใช้ set เก็บ signal ID ที่ประมวลผลไปแล้ว แทน lastReadSignalID
   ulong             m_processedIDs[];
   int               m_processedCount;
   int               m_maxProcessedHistory;  // จำกัดขนาด history

   string            GetSignalFilename(const TradeSignal &sig);
   bool              CreateDirectory();
   bool              IsAlreadyProcessed(ulong signalID);
   void              MarkProcessed(ulong signalID);

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
   m_directory             = CT_FILE_DIR;
   m_masterID              = "";
   m_processedCount        = 0;
   m_maxProcessedHistory   = 500;  // เก็บ history 500 signal IDs
   m_maxAge                = CT_FILE_MAX_AGE_SEC;
}

//+------------------------------------------------------------------+
//| Initialize transport                                              |
//+------------------------------------------------------------------+
bool CFileTransport::Init()
{
   return CreateDirectory();
}

//+------------------------------------------------------------------+
//| Create shared directory in FILE_COMMON                            |
//+------------------------------------------------------------------+
bool CFileTransport::CreateDirectory()
{
   // สร้าง folder ใน Common Files เพื่อให้ทุก MT5 terminal เข้าถึงได้
   if(!FolderCreate(m_directory, FILE_COMMON))
   {
      int err = GetLastError();
      if(err != 5020) // Already exists — ไม่เป็นเรื่อง
         CTLog(LOG_WARN, "FolderCreate (Common): " + IntegerToString(err));
   }
   return true;
}

//+------------------------------------------------------------------+
//| Check if signal ID was already processed                          |
//+------------------------------------------------------------------+
bool CFileTransport::IsAlreadyProcessed(ulong signalID)
{
   for(int i = 0; i < m_processedCount; i++)
   {
      if(m_processedIDs[i] == signalID)
         return true;
   }
   return false;
}

//+------------------------------------------------------------------+
//| Mark signal ID as processed                                       |
//+------------------------------------------------------------------+
void CFileTransport::MarkProcessed(ulong signalID)
{
   // ถ้า history เต็ม ลบครึ่งเก่าออก (FIFO)
   if(m_processedCount >= m_maxProcessedHistory)
   {
      int half = m_maxProcessedHistory / 2;
      for(int i = 0; i < m_processedCount - half; i++)
         m_processedIDs[i] = m_processedIDs[i + half];
      m_processedCount -= half;
      ArrayResize(m_processedIDs, m_processedCount);
   }

   m_processedCount++;
   ArrayResize(m_processedIDs, m_processedCount);
   m_processedIDs[m_processedCount - 1] = signalID;
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
//| Master: Write signal to file (ใช้ FILE_COMMON เสมอ)               |
//+------------------------------------------------------------------+
bool CFileTransport::WriteSignal(const TradeSignal &sig)
{
   string filename = GetSignalFilename(sig);
   string json = SignalToJson(sig);

   // ★ ใช้ FILE_COMMON เท่านั้น เพื่อให้ทุก terminal เห็นไฟล์เดียวกัน
   int handle = FileOpen(filename, FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
   if(handle == INVALID_HANDLE)
   {
      CTLog(LOG_ERROR, "WriteSignal: Cannot open file " + filename +
            " Error: " + IntegerToString(GetLastError()));
      return false;
   }

   FileWriteString(handle, json);
   FileClose(handle);

   CTLog(LOG_DEBUG, "Signal written: " + filename);
   return true;
}

//+------------------------------------------------------------------+
//| Slave: Read all pending signal files (ใช้ FILE_COMMON เสมอ)       |
//| ★ FIX v1.02: ใช้ set-based dedup แทน lastReadSignalID            |
//|   เพื่อป้องกันการข้าม signal เมื่อ file system คืนไฟล์ไม่เรียงลำดับ |
//+------------------------------------------------------------------+
int CFileTransport::ReadSignals(TradeSignal &signals[])
{
   ArrayResize(signals, 0);
   int count = 0;

   // ★ ค้นหาไฟล์ใน Common Files directory
   string filter = m_directory + CT_SIGNAL_PREFIX + "*" + CT_SIGNAL_EXT;
   string filename;
   long searchHandle = FileFindFirst(filter, filename, FILE_COMMON);

   if(searchHandle == INVALID_HANDLE)
      return 0;

   do
   {
      string filepath = m_directory + filename;

      // ★ ใช้ FILE_COMMON เท่านั้น — ให้ตรงกับ Master ที่เขียน
      int handle = FileOpen(filepath, FILE_READ | FILE_TXT | FILE_ANSI | FILE_COMMON);
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
         // ★ FIX: ใช้ set-based check แทน > lastID
         //   ทุก signal ที่ยังไม่เคยอ่านจะถูกประมวลผล ไม่มีการข้าม
         if(!IsAlreadyProcessed(sig.signalID) && sig.type != SIGNAL_HEARTBEAT)
         {
            MarkProcessed(sig.signalID);
            count++;
            ArrayResize(signals, count);
            signals[count - 1] = sig;
         }
      }

      // ★ FIX: ไม่ลบไฟล์ตรงนี้ เพื่อให้ Slave ตัวอื่นบน VPS เดียวกันสามารถอ่านได้ด้วย!
      // Master จะเป็นคนลบไฟล์เหล่านี้เองผ่าน CFileTransport::Cleanup()

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
   string filter = m_directory + CT_SIGNAL_PREFIX + "*" + CT_SIGNAL_EXT;
   string filename;
   long searchHandle = FileFindFirst(filter, filename, FILE_COMMON);

   if(searchHandle == INVALID_HANDLE) return;

   datetime now = TimeCurrent();
   do
   {
      string filepath = m_directory + filename;
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
            }
         }
      }
   } while(FileFindNext(searchHandle, filename));

   FileFindClose(searchHandle);
}

#endif // FILE_TRANSPORT_MQH
