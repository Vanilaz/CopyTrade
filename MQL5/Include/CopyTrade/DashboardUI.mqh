//+------------------------------------------------------------------+
//|                                                DashboardUI.mqh   |
//|                    Modern On-Chart GUI Dashboard                 |
//+------------------------------------------------------------------+
#property copyright "CopyTrade System"
#property version   "1.00"

class CDashboardUI
{
private:
   string m_prefix;
   int    m_x;
   int    m_y;
   int    m_width;
   int    m_rowHeight;
   int    m_margin;
   
   void CreateLabel(string name, int x, int y, string text, int fontSize, color clr, string font = "Segoe UI")
   {
      if(ObjectFind(0, name) < 0)
         ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
         
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetString(0, name, OBJPROP_TEXT, text);
      ObjectSetString(0, name, OBJPROP_FONT, font);
      ObjectSetInteger(0, name, OBJPROP_FONTSIZE, fontSize);
      ObjectSetInteger(0, name, OBJPROP_COLOR, clr);
      ObjectSetInteger(0, name, OBJPROP_BACK, false);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
   }

   void CreateLabelRight(string name, int x, int y, string text, int fontSize, color clr, string font = "Segoe UI")
   {
      CreateLabel(name, x, y, text, fontSize, clr, font);
      ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   }

   void CreateRect(string name, int x, int y, int w, int h, color bgClr, color borderClr)
   {
      if(ObjectFind(0, name) < 0)
         ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
         
      ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
      ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
      ObjectSetInteger(0, name, OBJPROP_XSIZE, w);
      ObjectSetInteger(0, name, OBJPROP_YSIZE, h);
      ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bgClr);
      ObjectSetInteger(0, name, OBJPROP_COLOR, borderClr);
      ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
      ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
      ObjectSetInteger(0, name, OBJPROP_BACK, true);
      ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   }

public:
   CDashboardUI()
   {
      m_prefix = "CT_GUI_";
      m_x = 30;
      m_y = 50;
      m_width = 300;
      m_rowHeight = 24;
      m_margin = 20;
   }
   
   ~CDashboardUI()
   {
      ObjectsDeleteAll(0, m_prefix);
      Comment(""); // Clear standard comment just in case
   }
   
   void Draw(string title, string &props[], string &vals[], int count, bool isMaster)
   {
      int h = m_margin * 2 + 40 + (count * m_rowHeight) + 10;
      
      // Modern SaaS Theme Colors
      color bgColor = C'15,17,21';        // Deep dark background
      color borderColor = C'30,34,45';    // Subtle border
      color accentColor = isMaster ? C'59,130,246' : C'16,185,129'; // Primary Blue / Success Green
      color titleColor = C'248,250,252';  // Bright text
      color labelColor = C'148,163,184';  // Muted slate
      
      string fontMain = "Trebuchet MS";
      
      // BG Shadow (Fake shadow with slightly offset darker rect)
      CreateRect(m_prefix + "BG_Shadow", m_x+4, m_y+4, m_width, h, C'5,5,5', C'5,5,5');
      
      // Main Panel
      CreateRect(m_prefix + "BG_Border", m_x-1, m_y-1, m_width+2, h+2, borderColor, borderColor);
      CreateRect(m_prefix + "BG", m_x, m_y, m_width, h, bgColor, bgColor);
      
      // Left Accent Strip (Rounded feeling)
      CreateRect(m_prefix + "Accent", m_x, m_y, 4, h, accentColor, accentColor);
      
      // Title
      CreateLabel(m_prefix + "Title", m_x + m_margin, m_y + m_margin - 5, title, 11, titleColor, fontMain);
      
      // Separator Line
      CreateRect(m_prefix + "Sep", m_x + m_margin, m_y + 45, m_width - (m_margin*2), 1, borderColor, borderColor);
      
      // Data Rows
      int startY = m_y + 60;
      for(int i=0; i<count; i++)
      {
         int curY = startY + (i * m_rowHeight);
         CreateLabel(m_prefix + "Prop" + IntegerToString(i), m_x + m_margin, curY, props[i], 9, labelColor, fontMain);
         
         // Value Coloring (Modern semantic colors)
         color valColor = titleColor;
         if(StringFind(vals[i], "Connected") >= 0 || StringFind(vals[i], "ON") >= 0) valColor = C'16,185,129'; // Green
         else if(StringFind(vals[i], "Disconnected") >= 0 || StringFind(vals[i], "Error") >= 0) valColor = C'239,68,68'; // Red
         else if(StringFind(vals[i], "Master") >= 0) valColor = C'245,158,11'; // Orange/Amber
         else if(StringFind(vals[i], "Slave") >= 0) valColor = C'59,130,246'; // Blue
         
         CreateLabelRight(m_prefix + "Val" + IntegerToString(i), m_x + m_width - m_margin, curY, vals[i], 9, valColor, fontMain);
      }
      
      ChartRedraw();
   }
};
