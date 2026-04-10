//+------------------------------------------------------------------+
//|                                            TradeExecutor.mqh     |
//|                      CTrade Wrapper — Retry, Lot Calc, SL/TP    |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.00"

#ifndef TRADE_EXECUTOR_MQH
#define TRADE_EXECUTOR_MQH

#include "CopyTradeDefines.mqh"
#include "SymbolMapper.mqh"
#include <Trade\Trade.mqh>

//+------------------------------------------------------------------+
//| CTradeExecutor Class                                              |
//+------------------------------------------------------------------+
class CTradeExecutor
{
private:
   CTrade            m_trade;
   CSymbolMapper    *m_mapper;
   ENUM_LOT_MODE     m_lotMode;
   ENUM_EXEC_MODE    m_execMode;
   double            m_lotRatio;
   double            m_fixedLot;
   double            m_riskPercent;
   int               m_maxRetries;
   int               m_retryDelayMs;
   double            m_maxSpread;
   int               m_slippage;
   int               m_matchSlippage;  // Tight slippage สำหรับ Match Master mode
   int               m_stalePriceMs;   // ถ้า signal เก่าเกินนี้ (ms) ใช้ market แทน

public:
                     CTradeExecutor();
                    ~CTradeExecutor() {}

   //--- Setup
   void              SetMapper(CSymbolMapper *mapper)    { m_mapper = mapper; }
   void              SetLotMode(ENUM_LOT_MODE mode)      { m_lotMode = mode; }
   void              SetLotRatio(double ratio)            { m_lotRatio = ratio; }
   void              SetFixedLot(double lot)              { m_fixedLot = lot; }
   void              SetRiskPercent(double pct)           { m_riskPercent = pct; }
   void              SetMaxRetries(int retries)           { m_maxRetries = retries; }
   void              SetMaxSpread(double spread)          { m_maxSpread = spread; }
   void              SetSlippage(int slip)                { m_slippage = slip; }
   void              SetMagic(int magic)                  { m_trade.SetExpertMagicNumber(magic); }
   void              SetExecMode(ENUM_EXEC_MODE mode)     { m_execMode = mode; }
   void              SetMatchSlippage(int slip)            { m_matchSlippage = slip; }
   void              SetStalePriceMs(int ms)               { m_stalePriceMs = ms; }

   //--- Trade operations
   long              ExecuteOpen(const TradeSignal &sig, string slaveSymbol);
   bool              ExecuteClose(long slavePositionID, string slaveSymbol);
   bool              ExecuteModify(long slavePositionID, double newSL, double newTP);
   bool              ExecutePartialClose(long slavePositionID, double percent);
   long              ExecutePendingOpen(const TradeSignal &sig, string slaveSymbol);
   bool              ExecutePendingModify(long slaveTicket, double newPrice, double newSL, double newTP);
   bool              ExecutePendingDelete(long slaveTicket);
   long              ExecuteLimitChase(const TradeSignal &sig, string slaveSymbol, double lots);
   long              ExecuteExactPending(const TradeSignal &sig, string slaveSymbol, double lots);

   //--- Lot calculation
   double            CalculateLot(string symbol, double masterLots, double sl, double entryPrice);
   double            NormalizeLot(string symbol, double lot);

   //--- Spread check
   bool              IsSpreadOK(string symbol);
   double            GetSpreadPoints(string symbol);
};

//+------------------------------------------------------------------+
//| Constructor                                                       |
//+------------------------------------------------------------------+
CTradeExecutor::CTradeExecutor()
{
   m_mapper         = NULL;
   m_lotMode        = LOT_EXACT;
   m_execMode       = EXEC_MATCH_MASTER;  // ค่าเริ่มต้น: match ราคา Master
   m_lotRatio       = 1.0;
   m_fixedLot       = 0.1;
   m_riskPercent    = 2.0;
   m_maxRetries     = 3;
   m_retryDelayMs   = 150;    // ลดจาก 500ms → 150ms เพื่อ retry เร็วขึ้น
   m_maxSpread      = 30;
   m_slippage       = 20;
   m_matchSlippage  = 30;    // Match mode: ยอมลื่น 30 points (Gold=$0.30, EURUSD=3.0pips)
   m_stalePriceMs   = 2000;  // ถ้า signal เก่าเกิน 2 วินาที ใช้ market แทน
   m_trade.SetDeviationInPoints(m_slippage);
   // ★ FIX: ไม่ hard-code filling mode — จะ detect อัตโนมัติตอน ExecuteOpen
   m_trade.SetAsyncMode(false);
}

//+------------------------------------------------------------------+
//| Execute open position                                             |
//+------------------------------------------------------------------+
long CTradeExecutor::ExecuteOpen(const TradeSignal &sig, string slaveSymbol)
{
   if(slaveSymbol == "")
   {
      CTLog(LOG_ERROR, "ExecuteOpen: Empty symbol");
      return -1;
   }

   if(!IsSpreadOK(slaveSymbol))
   {
      CTLog(LOG_WARN, "ExecuteOpen: Spread too high for " + slaveSymbol +
            " (" + DoubleToString(GetSpreadPoints(slaveSymbol), 1) + " pts)");
      return -1;
   }

   double lots = CalculateLot(slaveSymbol, sig.lots, sig.sl, sig.price);
   if(lots <= 0)
   {
      CTLog(LOG_ERROR, "ExecuteOpen: Invalid lot: " + DoubleToString(lots));
      return -1;
   }

   // ★ FIX: Auto-detect filling mode ที่ Broker รองรับ
   long fillPolicy = SymbolInfoInteger(slaveSymbol, SYMBOL_FILLING_MODE);
   if((fillPolicy & SYMBOL_FILLING_IOC) != 0)
      m_trade.SetTypeFilling(ORDER_FILLING_IOC);
   else if((fillPolicy & SYMBOL_FILLING_FOK) != 0)
      m_trade.SetTypeFilling(ORDER_FILLING_FOK);
   else
      m_trade.SetTypeFilling(ORDER_FILLING_RETURN);

   // Get current market price
   double ask = SymbolInfoDouble(slaveSymbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(slaveSymbol, SYMBOL_BID);
   int    digits = (int)SymbolInfoInteger(slaveSymbol, SYMBOL_DIGITS);

   //--- เลือก Execution Price ตาม Mode ---
   double execPrice = 0;     // 0 = market
   double marketPrice = (sig.orderType == ORDER_TYPE_BUY) ? ask : bid;
   long   ticketToReturn = -1;

   double point = SymbolInfoDouble(slaveSymbol, SYMBOL_POINT);

   // ★ FIX: ใช้ TimeCurrent() (broker server time) แทน GetTickCount64()
   // เพราะ cross-broker คนละเครื่อง GetTickCount64 (system uptime) ต่างกัน → latency ผิดเสมอ
   // TimeCurrent() มี resolution แค่ 1 วินาที แต่ทั้ง 2 broker sync กัน (ดีกว่าผิดทั้งหมด)
   ulong latencyMs = 99999;
   if(sig.timestamp > 0)
   {
      long diffSec = (long)TimeCurrent() - (long)sig.timestamp;
      if(diffSec >= 0) latencyMs = (ulong)(diffSec * 1000);
      else latencyMs = 0;  // slave เร็วกว่า master เล็กน้อย → ถือว่า fresh
   }

   if((m_execMode == EXEC_MATCH_MASTER || m_execMode == EXEC_LIMIT_CHASE) && sig.fillPrice > 0 && point > 0)
   {
      double diffPoints = MathAbs(marketPrice - sig.fillPrice) / point;

      // ★ Normalize ราคา Master ให้ตรงตาม digits ของ Slave symbol
      double masterExecPrice = NormalizeDouble(sig.fillPrice, digits);

      // ─── Tier 1: ราคาใกล้เคียง → ส่งราคา Master เป๊ะ + deviation แคบ ───
      if(diffPoints <= m_matchSlippage)
      {
         execPrice = masterExecPrice;
         m_trade.SetDeviationInPoints(m_matchSlippage);
         CTLog(LOG_INFO, "MATCH EXACT: Master price " + DoubleToString(execPrice, digits) +
               " (diff=" + DoubleToString(diffPoints, 1) + "pts, dev=" +
               IntegerToString(m_matchSlippage) + "pts)");
      }
      // ─── Tier 2: ราคาห่างปานกลาง → ยังลองใช้ราคา Master + deviation กว้าง ───
      // ★ FIX: ไม่เช็ค latency แล้ว — cross-broker latency วัดไม่ได้แม่น
      //   ถ้าราคายังอยู่ในช่วง ลองยิง master price เสมอ, requote → fallback market อยู่แล้ว
      else if(diffPoints <= m_matchSlippage * 5)
      {
         execPrice = masterExecPrice;
         int widerDev = (int)(diffPoints + m_matchSlippage);
         m_trade.SetDeviationInPoints(widerDev);
         CTLog(LOG_INFO, "MATCH WIDE: Master price " + DoubleToString(execPrice, digits) +
               " (diff=" + DoubleToString(diffPoints, 1) + "pts, dev=" +
               IntegerToString(widerDev) + "pts, latency~" +
               IntegerToString((long)latencyMs) + "ms)");
      }
      // ─── Tier 3: ราคาห่างมาก แต่ signal ยัง fresh → ยิง market ───
      else
      {
         execPrice = 0;
         m_trade.SetDeviationInPoints(m_slippage);
         CTLog(LOG_WARN, "MATCH FALLBACK: Price too far (" + DoubleToString(diffPoints, 1) +
               "pts, >" + IntegerToString(m_matchSlippage * 5) + ") → Market");
      }
   }
   else
   {
      execPrice = 0;
      m_trade.SetDeviationInPoints(m_slippage);
   }

   // Calculate SL/TP using pip distance
   double slaveEntry = (execPrice > 0) ? execPrice : marketPrice;
   double sl = 0, tp = 0;

   if(m_mapper != NULL && sig.sl != 0)
      sl = m_mapper.ConvertSLTP(sig.price, sig.sl, sig.symbol, slaveSymbol, slaveEntry);
   if(m_mapper != NULL && sig.tp != 0)
      tp = m_mapper.ConvertSLTP(sig.price, sig.tp, sig.symbol, slaveSymbol, slaveEntry);

   string comment = CT_COMMENT_PREFIX + sig.masterID + "_" + IntegerToString(sig.ticket);

   // Retry loop
   for(int attempt = 0; attempt < m_maxRetries; attempt++)
   {
      bool result = false;
      if(sig.orderType == ORDER_TYPE_BUY)
         result = m_trade.Buy(lots, slaveSymbol, execPrice, sl, tp, comment);
      else if(sig.orderType == ORDER_TYPE_SELL)
         result = m_trade.Sell(lots, slaveSymbol, execPrice, sl, tp, comment);

      if(result)
      {
         ulong resultTicket = m_trade.ResultOrder();
         double fillPrice = m_trade.ResultPrice();

         // Log ความแตกต่างของราคา (Price Discrepancy)
         if(sig.fillPrice > 0 && point > 0)
         {
            double priceDiff = MathAbs(fillPrice - sig.fillPrice);
            double diffPts = priceDiff / point;
            CTLog(LOG_INFO, "📊 PRICE MATCH: Master=" +
                  DoubleToString(sig.fillPrice, digits) +
                  " Slave=" + DoubleToString(fillPrice, digits) +
                  " Diff=" + DoubleToString(diffPts, 1) + "pts" +
                  " Latency~" + IntegerToString((long)latencyMs) + "ms");
         }

         CTLog(LOG_INFO, "✅ OPEN " + OrderTypeToStr(sig.orderType) + " " +
               slaveSymbol + " " + DoubleToString(lots, 2) + " lots @ " +
               DoubleToString(fillPrice, digits) + " — Ticket: " +
               IntegerToString((long)resultTicket));

         // Reset deviation กลับค่าปกติ
         m_trade.SetDeviationInPoints(m_slippage);
         return (long)resultTicket;
      }
      else
      {
         uint retcode = m_trade.ResultRetcode();
         CTLog(LOG_WARN, "⚠ OPEN attempt " + IntegerToString(attempt + 1) + "/" +
               IntegerToString(m_maxRetries) + " failed: " + m_trade.ResultRetcodeDescription() +
               " (code: " + IntegerToString(retcode) + ")");

         // ถ้า match price โดน requote → fallback ใช้ market
         if(m_execMode == EXEC_MATCH_MASTER && execPrice > 0 &&
            (retcode == TRADE_RETCODE_REQUOTE || retcode == TRADE_RETCODE_PRICE_OFF))
         {
            CTLog(LOG_WARN, "⚠ Requote at master price — falling back to market");
            execPrice = 0;
            m_trade.SetDeviationInPoints(m_slippage);
            // อัพเดท SL/TP ตาม market price ใหม่
            ask = SymbolInfoDouble(slaveSymbol, SYMBOL_ASK);
            bid = SymbolInfoDouble(slaveSymbol, SYMBOL_BID);
            slaveEntry = (sig.orderType == ORDER_TYPE_BUY) ? ask : bid;
            if(m_mapper != NULL && sig.sl != 0)
               sl = m_mapper.ConvertSLTP(sig.price, sig.sl, sig.symbol, slaveSymbol, slaveEntry);
            if(m_mapper != NULL && sig.tp != 0)
               tp = m_mapper.ConvertSLTP(sig.price, sig.tp, sig.symbol, slaveSymbol, slaveEntry);
            continue;  // retry ด้วย market price
         }

         // Don't retry on fatal errors
         if(retcode == TRADE_RETCODE_NO_MONEY ||
            retcode == TRADE_RETCODE_MARKET_CLOSED ||
            retcode == TRADE_RETCODE_TRADE_DISABLED ||
            retcode == TRADE_RETCODE_INVALID_VOLUME)
            break;

         Sleep(m_retryDelayMs);
      }
   }

   // Reset deviation กลับค่าปกติ
   m_trade.SetDeviationInPoints(m_slippage);

   CTLog(LOG_ERROR, "❌ OPEN FAILED after " + IntegerToString(m_maxRetries) + " attempts: " +
         slaveSymbol + " " + DoubleToString(lots, 2));
   return -1;
}

//+------------------------------------------------------------------+
//| Exact Pending Mode — วาง Pending Order ที่ราคาเดียวกับ Master    |
//+------------------------------------------------------------------+
long CTradeExecutor::ExecuteExactPending(const TradeSignal &sig, string slaveSymbol, double lots)
{
   int digits = (int)SymbolInfoInteger(slaveSymbol, SYMBOL_DIGITS);
   double targetPrice = NormalizeDouble(sig.fillPrice, digits);
   string comment = CT_COMMENT_PREFIX + sig.masterID + "_" + IntegerToString(sig.ticket);

   double ask = SymbolInfoDouble(slaveSymbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(slaveSymbol, SYMBOL_BID);

   // SL/TP
   double sl = 0, tp = 0;
   if(m_mapper != NULL && sig.sl != 0)
      sl = m_mapper.ConvertSLTP(sig.price, sig.sl, sig.symbol, slaveSymbol, targetPrice);
   if(m_mapper != NULL && sig.tp != 0)
      tp = m_mapper.ConvertSLTP(sig.price, sig.tp, sig.symbol, slaveSymbol, targetPrice);

   bool result = false;

   if(sig.orderType == ORDER_TYPE_BUY)
   {
      if(targetPrice < ask)
         result = m_trade.BuyLimit(lots, targetPrice, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment);
      else
         result = m_trade.BuyStop(lots, targetPrice, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment);
   }
   else if(sig.orderType == ORDER_TYPE_SELL)
   {
      if(targetPrice > bid)
         result = m_trade.SellLimit(lots, targetPrice, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment);
      else
         result = m_trade.SellStop(lots, targetPrice, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment);
   }

   if(result)
   {
      ulong orderTicket = m_trade.ResultOrder();
      CTLog(LOG_INFO, "✅ EXACT MATCH PENDING: Placed " + OrderTypeToStr(sig.orderType) +
            " Pending @ " + DoubleToString(targetPrice, digits));
      return (long)orderTicket;
   }
   else
   {
      CTLog(LOG_WARN, "⚠ Exact Match Pending failed: " + m_trade.ResultRetcodeDescription() + " -> Fallback Market");
      
      // Fallback
      m_trade.SetDeviationInPoints(m_slippage);
      if(sig.orderType == ORDER_TYPE_BUY)
         result = m_trade.Buy(lots, slaveSymbol, 0, sl, tp, comment);
      else
         result = m_trade.Sell(lots, slaveSymbol, 0, sl, tp, comment);
         
      if(result) return (long)m_trade.ResultOrder();
   }

   return -1;
}

//+------------------------------------------------------------------+
//| Limit Chase Mode — วาง limit ตามราคา Master, ถ้าไม่ fill ก็ market|
//+------------------------------------------------------------------+
long CTradeExecutor::ExecuteLimitChase(const TradeSignal &sig, string slaveSymbol, double lots)
{
   int digits = (int)SymbolInfoInteger(slaveSymbol, SYMBOL_DIGITS);
   double limitPrice = NormalizeDouble(sig.fillPrice, digits);
   string comment = CT_COMMENT_PREFIX + sig.masterID + "_" + IntegerToString(sig.ticket);

   // SL/TP
   double sl = 0, tp = 0;
   if(m_mapper != NULL && sig.sl != 0)
      sl = m_mapper.ConvertSLTP(sig.price, sig.sl, sig.symbol, slaveSymbol, limitPrice);
   if(m_mapper != NULL && sig.tp != 0)
      tp = m_mapper.ConvertSLTP(sig.price, sig.tp, sig.symbol, slaveSymbol, limitPrice);

   // วาง limit order
   bool result = false;
   if(sig.orderType == ORDER_TYPE_BUY)
      result = m_trade.BuyLimit(lots, limitPrice, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment);
   else
      result = m_trade.SellLimit(lots, limitPrice, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment);

   if(!result)
   {
      CTLog(LOG_WARN, "Limit chase: limit order failed → trying market");
      m_trade.SetDeviationInPoints(m_slippage);
      if(sig.orderType == ORDER_TYPE_BUY)
         result = m_trade.Buy(lots, slaveSymbol, 0, sl, tp, comment);
      else
         result = m_trade.Sell(lots, slaveSymbol, 0, sl, tp, comment);

      if(result) return (long)m_trade.ResultOrder();
      return -1;
   }

   ulong orderTicket = m_trade.ResultOrder();
   CTLog(LOG_INFO, "⏳ LIMIT CHASE: placed " + OrderTypeToStr(sig.orderType) +
         " limit @ " + DoubleToString(limitPrice, digits));

   // รอ fill สูงสุด 3 วินาที (ตรวจทุก 200ms)
   for(int wait = 0; wait < 15; wait++)
   {
      Sleep(200);
      if(PositionSelectByTicket(orderTicket))
      {
         // Limit order filled!
         CTLog(LOG_INFO, "✅ LIMIT FILLED @ " +
               DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), digits));
         return (long)orderTicket;
      }

      // ตรวจว่า order ยังอยู่ไหม
      if(!OrderSelect(orderTicket))
         break;
   }

   // ไม่ fill → cancel limit แล้ว market
   CTLog(LOG_WARN, "Limit not filled in 3s → cancel and execute market");
   m_trade.OrderDelete(orderTicket);
   Sleep(100);

   // Market execution fallback
   double ask = SymbolInfoDouble(slaveSymbol, SYMBOL_ASK);
   double bid = SymbolInfoDouble(slaveSymbol, SYMBOL_BID);
   double mktEntry = (sig.orderType == ORDER_TYPE_BUY) ? ask : bid;

   if(m_mapper != NULL && sig.sl != 0)
      sl = m_mapper.ConvertSLTP(sig.price, sig.sl, sig.symbol, slaveSymbol, mktEntry);
   if(m_mapper != NULL && sig.tp != 0)
      tp = m_mapper.ConvertSLTP(sig.price, sig.tp, sig.symbol, slaveSymbol, mktEntry);

   m_trade.SetDeviationInPoints(m_slippage);
   if(sig.orderType == ORDER_TYPE_BUY)
      result = m_trade.Buy(lots, slaveSymbol, 0, sl, tp, comment);
   else
      result = m_trade.Sell(lots, slaveSymbol, 0, sl, tp, comment);

   if(result)
   {
      CTLog(LOG_INFO, "✅ MARKET FALLBACK filled @ " +
            DoubleToString(m_trade.ResultPrice(), digits));
      return (long)m_trade.ResultOrder();
   }

   return -1;
}

//+------------------------------------------------------------------+
//| Close position by position ID                                     |
//+------------------------------------------------------------------+
bool CTradeExecutor::ExecuteClose(long slavePositionID, string slaveSymbol)
{
   for(int attempt = 0; attempt < m_maxRetries; attempt++)
   {
      if(m_trade.PositionClose((ulong)slavePositionID))
      {
         CTLog(LOG_INFO, "✅ CLOSE position #" + IntegerToString(slavePositionID));
         return true;
      }

      uint retcode = m_trade.ResultRetcode();
      CTLog(LOG_WARN, "⚠ CLOSE attempt " + IntegerToString(attempt + 1) + " failed: " +
            m_trade.ResultRetcodeDescription());

      if(retcode == TRADE_RETCODE_MARKET_CLOSED)
         break;

      Sleep(m_retryDelayMs);
   }

   CTLog(LOG_ERROR, "❌ CLOSE FAILED position #" + IntegerToString(slavePositionID));
   return false;
}

//+------------------------------------------------------------------+
//| Modify SL/TP of position                                          |
//+------------------------------------------------------------------+
bool CTradeExecutor::ExecuteModify(long slavePositionID, double newSL, double newTP)
{
   if(!PositionSelectByTicket((ulong)slavePositionID))
   {
      CTLog(LOG_ERROR, "ExecuteModify: Position not found #" + IntegerToString(slavePositionID));
      return false;
   }

   string symbol = PositionGetString(POSITION_SYMBOL);
   int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
   newSL = NormalizeDouble(newSL, digits);
   newTP = NormalizeDouble(newTP, digits);

   for(int attempt = 0; attempt < m_maxRetries; attempt++)
   {
      if(m_trade.PositionModify((ulong)slavePositionID, newSL, newTP))
      {
         CTLog(LOG_INFO, "✅ MODIFY position #" + IntegerToString(slavePositionID) +
               " SL=" + DoubleToString(newSL, digits) + " TP=" + DoubleToString(newTP, digits));
         return true;
      }
      else
      {
         uint retcode = m_trade.ResultRetcode();
         // If no changes were actually made, it's not a real error.
         if(retcode == 10025) // TRADE_RETCODE_NO_CHANGES
         {
            return true;
         }
         CTLog(LOG_WARN, "⚠ MODIFY failed #" + IntegerToString(slavePositionID) + ": " + 
               m_trade.ResultRetcodeDescription() + " (code: " + IntegerToString(retcode) + ")");
      }
      Sleep(m_retryDelayMs);
   }
   return false;
}

//+------------------------------------------------------------------+
//| Partial close position                                            |
//+------------------------------------------------------------------+
bool CTradeExecutor::ExecutePartialClose(long slavePositionID, double percent)
{
   if(!PositionSelectByTicket((ulong)slavePositionID))
   {
      CTLog(LOG_ERROR, "ExecutePartialClose: Position not found #" + IntegerToString(slavePositionID));
      return false;
   }

   double currentLots = PositionGetDouble(POSITION_VOLUME);
   double closeLots = NormalizeLot(PositionGetString(POSITION_SYMBOL),
                                    currentLots * percent / 100.0);

   if(closeLots <= 0) closeLots = NormalizeLot(PositionGetString(POSITION_SYMBOL), currentLots);

   for(int attempt = 0; attempt < m_maxRetries; attempt++)
   {
      if(m_trade.PositionClosePartial((ulong)slavePositionID, closeLots))
      {
         CTLog(LOG_INFO, "✅ PARTIAL CLOSE #" + IntegerToString(slavePositionID) +
               " " + DoubleToString(closeLots, 2) + " lots (" + DoubleToString(percent, 1) + "%)");
         return true;
      }
      Sleep(m_retryDelayMs);
   }
   return false;
}

//+------------------------------------------------------------------+
//| Open pending order                                                |
//+------------------------------------------------------------------+
long CTradeExecutor::ExecutePendingOpen(const TradeSignal &sig, string slaveSymbol)
{
   if(slaveSymbol == "" || !IsSpreadOK(slaveSymbol)) return -1;

   double lots = CalculateLot(slaveSymbol, sig.lots, sig.sl, sig.price);
   if(lots <= 0) return -1;

   // Use market price for pending — same price level
   double price = sig.price;
   int digits = (int)SymbolInfoInteger(slaveSymbol, SYMBOL_DIGITS);
   price = NormalizeDouble(price, digits);

   double sl = 0, tp = 0;
   if(m_mapper != NULL)
   {
      if(sig.sl != 0) sl = m_mapper.ConvertSLTP(sig.price, sig.sl, sig.symbol, slaveSymbol, price);
      if(sig.tp != 0) tp = m_mapper.ConvertSLTP(sig.price, sig.tp, sig.symbol, slaveSymbol, price);
   }

   string comment = CT_COMMENT_PREFIX + sig.masterID + "_P_" + IntegerToString(sig.ticket);

   bool result = false;
   switch(sig.orderType)
   {
      case ORDER_TYPE_BUY_LIMIT:  result = m_trade.BuyLimit(lots, price, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment); break;
      case ORDER_TYPE_SELL_LIMIT: result = m_trade.SellLimit(lots, price, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment); break;
      case ORDER_TYPE_BUY_STOP:   result = m_trade.BuyStop(lots, price, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment); break;
      case ORDER_TYPE_SELL_STOP:  result = m_trade.SellStop(lots, price, slaveSymbol, sl, tp, ORDER_TIME_GTC, 0, comment); break;
      default: return -1;
   }

   if(result)
   {
      long ticket = (long)m_trade.ResultOrder();
      CTLog(LOG_INFO, "✅ PENDING " + OrderTypeToStr(sig.orderType) + " " +
            slaveSymbol + " " + DoubleToString(lots, 2) + " @ " + DoubleToString(price, digits));
      return ticket;
   }
   return -1;
}

//+------------------------------------------------------------------+
//| Modify pending order                                              |
//+------------------------------------------------------------------+
bool CTradeExecutor::ExecutePendingModify(long slaveTicket, double newPrice, double newSL, double newTP)
{
   return m_trade.OrderModify((ulong)slaveTicket, newPrice, newSL, newTP, ORDER_TIME_GTC, 0);
}

//+------------------------------------------------------------------+
//| Delete pending order                                              |
//+------------------------------------------------------------------+
bool CTradeExecutor::ExecutePendingDelete(long slaveTicket)
{
   return m_trade.OrderDelete((ulong)slaveTicket);
}

//+------------------------------------------------------------------+
//| Calculate lot based on mode                                       |
//+------------------------------------------------------------------+
double CTradeExecutor::CalculateLot(string symbol, double masterLots, double sl, double entryPrice)
{
   double lot = 0;

   switch(m_lotMode)
   {
      case LOT_EXACT:
         lot = masterLots;
         break;

      case LOT_RATIO:
         lot = masterLots * m_lotRatio;
         break;

      case LOT_FIXED:
         lot = m_fixedLot;
         break;

      case LOT_BALANCE:
      {
         double balance = AccountInfoDouble(ACCOUNT_BALANCE);
         double riskAmount = balance * m_riskPercent / 100.0;

         if(sl != 0 && entryPrice != 0)
         {
            double slDistance = MathAbs(entryPrice - sl);
            double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
            double tickSize  = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);

            if(tickValue > 0 && tickSize > 0 && slDistance > 0)
            {
               double riskPerLot = (slDistance / tickSize) * tickValue;
               lot = riskAmount / riskPerLot;
            }
            else
               lot = m_fixedLot;
         }
         else
            lot = m_fixedLot;
         break;
      }
   }

   return NormalizeLot(symbol, lot);
}

//+------------------------------------------------------------------+
//| Normalize lot to broker requirements                              |
//+------------------------------------------------------------------+
double CTradeExecutor::NormalizeLot(string symbol, double lot)
{
   double minLot  = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double stepLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

   if(stepLot <= 0) stepLot = 0.01;
   if(minLot <= 0)  minLot  = 0.01;
   if(maxLot <= 0)  maxLot  = 100.0;

   // Round to step
   lot = MathFloor(lot / stepLot) * stepLot;
   lot = NormalizeDouble(lot, 2);

   if(lot < minLot) lot = minLot;
   if(lot > maxLot) lot = maxLot;

   return lot;
}

//+------------------------------------------------------------------+
//| Check if spread is acceptable                                     |
//+------------------------------------------------------------------+
bool CTradeExecutor::IsSpreadOK(string symbol)
{
   return (GetSpreadPoints(symbol) <= m_maxSpread);
}

//+------------------------------------------------------------------+
//| Get current spread in points                                      |
//+------------------------------------------------------------------+
double CTradeExecutor::GetSpreadPoints(string symbol)
{
   return (double)SymbolInfoInteger(symbol, SYMBOL_SPREAD);
}

#endif // TRADE_EXECUTOR_MQH
