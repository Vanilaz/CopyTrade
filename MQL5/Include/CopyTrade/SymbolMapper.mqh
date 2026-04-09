//+------------------------------------------------------------------+
//|                                             SymbolMapper.mqh     |
//|                Cross-Broker Symbol Mapping — Auto & Manual       |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.00"

#ifndef SYMBOL_MAPPER_MQH
#define SYMBOL_MAPPER_MQH

#include "CopyTradeDefines.mqh"

//+------------------------------------------------------------------+
//| Symbol Mapping Entry                                              |
//+------------------------------------------------------------------+
struct SymbolMapEntry
{
   string masterSymbol;
   string slaveSymbol;
};

//+------------------------------------------------------------------+
//| CSymbolMapper Class                                               |
//+------------------------------------------------------------------+
class CSymbolMapper
{
private:
   SymbolMapEntry    m_map[];
   int               m_mapSize;
   string            m_suffix;
   string            m_prefix;
   bool              m_autoDetect;

public:
                     CSymbolMapper();
                    ~CSymbolMapper() {}

   //--- Initialization
   void              SetSuffix(string suffix)  { m_suffix = suffix; }
   void              SetPrefix(string prefix)  { m_prefix = prefix; }
   void              SetAutoDetect(bool auto_) { m_autoDetect = auto_; }
   bool              LoadMapFile(string filename);

   //--- Mapping
   string            MapSymbol(string masterSymbol);
   string            ReverseMap(string slaveSymbol);
   bool              IsSymbolAvailable(string symbol);

   //--- Auto-detect suffix/prefix
   bool              AutoDetectBrokerFormat();

   //--- Digit conversion
   int               GetDigits(string symbol);
   double            GetPoint(string symbol);
   double            ConvertPrice(double masterPrice, string masterSym, string slaveSym);
   double            ConvertSLTP(double masterEntry, double sltp, string masterSym, string slaveSym, double slaveEntry);
};

//+------------------------------------------------------------------+
//| Constructor                                                       |
//+------------------------------------------------------------------+
CSymbolMapper::CSymbolMapper()
{
   m_mapSize   = 0;
   m_suffix    = "";
   m_prefix    = "";
   m_autoDetect = true;
}

//+------------------------------------------------------------------+
//| Load symbol map from CSV file                                     |
//| Format: MasterSymbol,SlaveSymbol                                  |
//+------------------------------------------------------------------+
bool CSymbolMapper::LoadMapFile(string filename)
{
   string filepath = CT_FILE_DIR + filename;
   int handle = FileOpen(filepath, FILE_READ | FILE_TXT | FILE_ANSI);
   if(handle == INVALID_HANDLE)
   {
      CTLog(LOG_WARN, "Symbol map file not found: " + filepath + " — using auto-detect");
      return false;
   }

   while(!FileIsEnding(handle))
   {
      string line = FileReadString(handle);
      // Skip comments and empty lines
      if(StringLen(line) == 0 || StringGetCharacter(line, 0) == '#')
         continue;

      string parts[];
      int count = StringSplit(line, ',', parts);
      if(count >= 2)
      {
         int idx = m_mapSize;
         m_mapSize++;
         ArrayResize(m_map, m_mapSize);
         // Trim spaces
         StringTrimLeft(parts[0]);
         StringTrimRight(parts[0]);
         StringTrimLeft(parts[1]);
         StringTrimRight(parts[1]);
         m_map[idx].masterSymbol = parts[0];
         m_map[idx].slaveSymbol  = parts[1];
      }
   }
   FileClose(handle);

   CTLog(LOG_INFO, "Loaded " + IntegerToString(m_mapSize) + " symbol mappings from " + filename);
   return (m_mapSize > 0);
}

//+------------------------------------------------------------------+
//| Map master symbol to slave symbol                                 |
//+------------------------------------------------------------------+
string CSymbolMapper::MapSymbol(string masterSymbol)
{
   // 1. Check manual map first
   for(int i = 0; i < m_mapSize; i++)
   {
      if(m_map[i].masterSymbol == masterSymbol)
         return m_map[i].slaveSymbol;
   }

   // 2. Apply prefix/suffix
   string mapped = m_prefix + masterSymbol + m_suffix;

   // 3. Check if mapped symbol exists
   if(IsSymbolAvailable(mapped))
      return mapped;

   // 4. Try original symbol (same broker)
   if(IsSymbolAvailable(masterSymbol))
      return masterSymbol;

   // 5. Auto-detect: try common suffixes by extracting base symbol first
   if(m_autoDetect)
   {
      string baseMaster = masterSymbol;
      
      // Remove common separators to find base symbol (e.g. XAUUSD.r -> XAUUSD)
      int sepIdx = StringFind(baseMaster, ".");
      if (sepIdx > 0) baseMaster = StringSubstr(baseMaster, 0, sepIdx);
      sepIdx = StringFind(baseMaster, "-");
      if (sepIdx > 0) baseMaster = StringSubstr(baseMaster, 0, sepIdx);
      sepIdx = StringFind(baseMaster, "_");
      if (sepIdx > 0) baseMaster = StringSubstr(baseMaster, 0, sepIdx);
      
      // First try suffixes on the clean baseMaster
      string suffixes[] = {"", "m", ".i", ".e", "-ECN", ".pro", "_SB", ".r", ".s", ".std", "std", "c"};
      for(int i = 0; i < ArraySize(suffixes); i++)
      {
         string trySymbol = baseMaster + suffixes[i];
         if(IsSymbolAvailable(trySymbol))
         {
            CTLog(LOG_INFO, "Auto-detected mapping: " + masterSymbol + " → " + trySymbol);
            int idx = m_mapSize;
            m_mapSize++;
            ArrayResize(m_map, m_mapSize);
            m_map[idx].masterSymbol = masterSymbol;
            m_map[idx].slaveSymbol  = trySymbol;
            return trySymbol;
         }
      }

      // Try common prefixes
      string prefixes[] = {"", "m.", "i.", "#"};
      for(int i = 0; i < ArraySize(prefixes); i++)
      {
         string trySymbol = prefixes[i] + baseMaster;
         if(IsSymbolAvailable(trySymbol))
         {
            CTLog(LOG_INFO, "Auto-detected mapping: " + masterSymbol + " → " + trySymbol);
            int idx = m_mapSize;
            m_mapSize++;
            ArrayResize(m_map, m_mapSize);
            m_map[idx].masterSymbol = masterSymbol;
            m_map[idx].slaveSymbol  = trySymbol;
            return trySymbol;
         }
      }
      
      // 6. Deep Scan (Fuzzy Match) for completely unknown broker formats
      int total = SymbolsTotal(false);
      string bestMatch = "";
      int bestMatchLen = 0;
      int minLenDiff = 9999;
      
      for(int i = 0; i < total; i++)
      {
         string sym = SymbolName(i, false);
         // Check if one is a substring of the other using the BASE symbol, not the suffixed one
         if(StringFind(sym, baseMaster) >= 0 || StringFind(baseMaster, sym) >= 0)
         {
            if(IsSymbolAvailable(sym))
            {
               int matchLen = (int)MathMin(StringLen(sym), StringLen(baseMaster));
               int lenDiff = (int)MathAbs(StringLen(sym) - StringLen(baseMaster));
               
               // Maximize overlap, then minimize remainder
               if(matchLen > bestMatchLen || (matchLen == bestMatchLen && lenDiff < minLenDiff))
               {
                  bestMatchLen = matchLen;
                  minLenDiff = lenDiff;
                  bestMatch = sym;
               }
            }
         }
      }
      
      if(bestMatch != "")
      {
         CTLog(LOG_INFO, "🛠 Fuzzy-detected mapping: " + masterSymbol + " → " + bestMatch);
         int idx = m_mapSize;
         m_mapSize++;
         ArrayResize(m_map, m_mapSize);
         m_map[idx].masterSymbol = masterSymbol;
         m_map[idx].slaveSymbol  = bestMatch;
         return bestMatch;
      }
   }

   CTLog(LOG_ERROR, "Cannot map symbol: " + masterSymbol);
   return "";
}

//+------------------------------------------------------------------+
//| Reverse map: slave symbol → master symbol                         |
//+------------------------------------------------------------------+
string CSymbolMapper::ReverseMap(string slaveSymbol)
{
   for(int i = 0; i < m_mapSize; i++)
   {
      if(m_map[i].slaveSymbol == slaveSymbol)
         return m_map[i].masterSymbol;
   }
   return slaveSymbol;
}

//+------------------------------------------------------------------+
//| Check if symbol exists and is available for trading               |
//+------------------------------------------------------------------+
bool CSymbolMapper::IsSymbolAvailable(string symbol)
{
   if(symbol == "") return false;
   bool exists = SymbolInfoInteger(symbol, SYMBOL_EXIST) > 0;
   if(!exists) return false;

   // Select in Market Watch
   if(!SymbolInfoInteger(symbol, SYMBOL_SELECT))
      SymbolSelect(symbol, true);

   // Check trade mode
   ENUM_SYMBOL_TRADE_MODE tradeMode = (ENUM_SYMBOL_TRADE_MODE)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
   return (tradeMode != SYMBOL_TRADE_MODE_DISABLED);
}

//+------------------------------------------------------------------+
//| Auto-detect broker format by checking EURUSD variants             |
//+------------------------------------------------------------------+
bool CSymbolMapper::AutoDetectBrokerFormat()
{
   string baseSymbols[] = {"EURUSD", "GBPUSD", "USDJPY", "XAUUSD"};
   string suffixes[]    = {"", "m", ".i", ".e", "-ECN", ".pro", "_SB", ".r", ".s", ".std", "std"};
   string prefixes[]    = {"", "m.", "i.", "#"};

   for(int b = 0; b < ArraySize(baseSymbols); b++)
   {
      for(int s = 0; s < ArraySize(suffixes); s++)
      {
         for(int p = 0; p < ArraySize(prefixes); p++)
         {
            string test = prefixes[p] + baseSymbols[b] + suffixes[s];
            if(IsSymbolAvailable(test))
            {
               if(suffixes[s] != "" || prefixes[p] != "")
               {
                  m_suffix = suffixes[s];
                  m_prefix = prefixes[p];
                  CTLog(LOG_INFO, "Auto-detected broker format: prefix=\"" + m_prefix + "\" suffix=\"" + m_suffix + "\"");
                  return true;
               }
            }
         }
      }
   }
   return false;
}

//+------------------------------------------------------------------+
//| Get digits for symbol                                             |
//+------------------------------------------------------------------+
int CSymbolMapper::GetDigits(string symbol)
{
   return (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
}

//+------------------------------------------------------------------+
//| Get point size for symbol                                         |
//+------------------------------------------------------------------+
double CSymbolMapper::GetPoint(string symbol)
{
   return SymbolInfoDouble(symbol, SYMBOL_POINT);
}

//+------------------------------------------------------------------+
//| Convert SL/TP: Use pip distance from master entry, apply to slave |
//+------------------------------------------------------------------+
double CSymbolMapper::ConvertSLTP(double masterEntry, double sltp, string masterSym, string slaveSym, double slaveEntry)
{
   if(sltp == 0) return 0;

   double masterPoint = GetPoint(masterSym);
   double slavePoint  = GetPoint(slaveSym);

   if(masterPoint == 0 || slavePoint == 0) return 0;

   // Calculate distance in points (master)
   double distPoints = (sltp - masterEntry) / masterPoint;

   // Apply same distance to slave entry
   double slavePrice = slaveEntry + distPoints * slavePoint;
   return NormalizeDouble(slavePrice, GetDigits(slaveSym));
}

#endif // SYMBOL_MAPPER_MQH
