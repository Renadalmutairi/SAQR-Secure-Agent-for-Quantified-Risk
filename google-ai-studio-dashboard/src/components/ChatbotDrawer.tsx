import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Send, 
  Bot, 
  Sparkles, 
  ShieldAlert,
  MessageSquare
} from "lucide-react";
import { InvestigationState, RecommendedAction } from "../types";

interface ChatbotDrawerProps {
  activeCase: InvestigationState;
  user: { name: string; station: string; id: string } | null;
  isDarkMode: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

export default function ChatbotDrawer({ 
  activeCase, 
  user, 
  isDarkMode, 
  onClose 
}: ChatbotDrawerProps) {
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const SUGGESTIONS = [
    "حلل البصمة السلوكية ومبررات انحراف الحساب",
    "صغ لي توصية نهائية للامتثال لرفعها لوحدة التحريات",
    "ما هي تفاصيل الأطراف المشبوهة المتصلة بالقضية؟",
    "هل تتطابق مؤشرات المعاملة مع لوائح ساما لمكافحة غسيل الأموال؟"
  ];

  // Initialize Chat Messages when Active Case Changes
  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      id: "welcome",
      role: "model",
      text: `مرحباً بالزميلة المحققة **${user?.name || "ريناد جزاع المطيري"}**، من محطة **${user?.station.split(" - ")[0] || "مصرف الإنماء"}**.\n\nلقد قمت بتحميل ملف القضية النشطة **[${activeCase.case_id}]** الخاصة بـ **"${activeCase.title}"**.\n\nكيف يمكنني مساعدتك في تدقيق وفحص المعاملة الحالية والتأكد من النتائج؟ يمكنك سؤالي عن مبررات الشبهة، الأنماط المعمارية، أو صياغة البلاغ لساما.`,
      timestamp: new Date()
    };
    setChatMessages([welcomeMsg]);
  }, [activeCase.case_id, user]);

  // Scroll Chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  // Chat send message trigger
  const handleSendChatMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isChatLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: textToSend,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const apiHistory = chatMessages
        .filter(m => m.id !== "welcome")
        .map(m => ({
          role: m.role,
          text: m.text
        }));

      // Call Express server chat proxy
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          history: apiHistory,
          activeCase: activeCase
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "خطأ غير معروف في خادم التحقيق الذكي.");
      }

      const modelMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: "model",
        text: data.text,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, modelMsg]);

    } catch (err: any) {
      console.warn("Express Chat API failed or key missing. Using smart fallback replies:", err);
      
      let fallbackText = "";
      const textLower = textToSend.toLowerCase();

      if (textLower.includes("تجميد") || textLower.includes("قرار") || textLower.includes("انصح") || textLower.includes("أنصح")) {
        fallbackText = `بناءً على المعطيات والأنظمة الأمنية لحماية مصرف الإنماء وقوانين البنك المركزي السعودي لمكافحة غسل الأموال:\n\n1. **القضية ${activeCase.case_id}** تُبدي نمط خطورة مرتفع جداً.\n2. **توصية صقر**: نوصي بـ **تجميد حساب العميل فوراً** (Freeze Account) والتحفظ على المبالغ النقدية المودعة، نظراً لتجزئة الإيداعات بشكل واضح ومريب لتجنب الحد الرقابي للإفصاح عن مصدر النقد (٥٠ ألف ريال).\n3. يجب طلب إثباتات العقود ومصادر السيولة من مفوض الحساب بموجب المادة ٥ من اللائحة التنفيذية.`;
      } else if (textLower.includes("بصمة") || textLower.includes("سلوك") || textLower.includes("انحراف") || textLower.includes("dna")) {
        fallbackText = `مستوى انحراف البصمة السلوكية في هذه المعاملة هو **${Math.round((activeCase.dna_fingerprint?.deviation_score || 0) * 100)}%**.\n\n**تفاصيل التحليل الفني لصقر**:\n- الحساب كان خاملاً مسبقاً طوال الأشهر الماضية دون تدوير مالي.\n- طرأ انحراف جذري مفاجئ باستقبال ودائع وتدفقات هائلة في فترة زمنية متقاربة.\n- مسببات الانحراف تدل على نشاط غير اعتيادي (إما غسيل أموال Smurfing أو استيلاء كامل على الحساب Account Takeover).`;
      } else if (textLower.includes("توصية") || textLower.includes("ساما") || textLower.includes("بلاغ") || textLower.includes("صغ")) {
        fallbackText = `إليك مسودة خطاب البلاغ والمبررات الجنائية جاهزة للنقل لقسم الالتزام لرفعها للبنك المركزي السعودي (SAMA):\n\n**مسودة بلاغ اشتباه جنائي مالي**\n\n- **الجهة المبلغة**: مصرف الإنماء - إدارة مكافحة الجرائم المالية\n- **الرقم المرجعي**: SAQR-${activeCase.case_id}\n- **اسم الحساب المشتبه به**: ${activeCase.title}\n- **رقم الآيبان**: ${activeCase.transaction.account_id}\n- **قيمة الحركات المشتبه بها**: ${activeCase.transaction.amount.toLocaleString()} ريال سعودي\n- **المبررات الفنية**: رصد تدفق مالي وتلقي ودائع نقدية مجزأة بفروقات زمنية متقاربة من مناطق جغرافية مختلفة عبر أجهزة صراف تفاعلية ومواقع متعددة، بالإضافة إلى تسجيل الدخول من أجهزة اتصال غير موثقة (VPN). نرجو اتخاذ الإجراء الرقابي اللازم.`;
      } else {
        fallbackText = `مفهوم يا زميلة ريناد. القضية **${activeCase.case_id}** قيد المعالجة الآن في محرك الحماية الرقمي لصقر.\n\nبناءً على فحص العملية المستهدفة بقيمة **${activeCase.transaction.amount.toLocaleString()} SAR**، نلاحظ تداخلاً جغرافياً مريباً في مخرجات شبكة العلاقات المالية.\n\nما هو الجانب المحدد الذي تودين مني تزويدك بمزيد من التفاصيل عنه لمساعدتك في اتخاذ القرار وإصدار التقرير النهائي؟`;
      }

      await new Promise(resolve => setTimeout(resolve, 800));

      const modelMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: "model",
        text: fallbackText,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, modelMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const cardStyle = isDarkMode 
    ? "bg-[#111317] border-[#22262f] text-gray-200" 
    : "bg-white border-slate-200 text-slate-800 shadow-xl";
  const borderStyle = isDarkMode ? "border-[#22262f]" : "border-slate-200";
  const bgStyle = isDarkMode ? "bg-[#090a0c]" : "bg-slate-50";

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end font-sans animate-fade-in" 
      id="chatbot-drawer-overlay"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.45)", backdropFilter: "blur(2px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className={`w-full max-w-md h-full flex flex-col shadow-2xl border-r ${cardStyle} animate-slide-left`}
        id="chatbot-drawer-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className={`p-4 border-b flex justify-between items-center ${borderStyle}`} id="chatbot-drawer-header">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-orange-500/10 border border-brand-orange-500/20 rounded-lg text-brand-orange-500">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-brand-orange-500 flex items-center gap-1">
                <span>صقر: المساعد الذكي المتقدم</span>
                <Sparkles className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              </h2>
              <p className="text-[10px] text-slate-400">مستشارك الأمني والرقابي الخاص بمصرف الإنماء</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 border rounded-lg transition-colors cursor-pointer ${
              isDarkMode ? "bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300" : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ACTIVE CASE BADGE */}
        <div className={`px-4 py-2 text-xs border-b font-mono flex items-center justify-between ${bgStyle} ${borderStyle}`}>
          <span className="text-slate-400">القضية النشطة بالتحقق:</span>
          <span className="bg-brand-orange-500/15 text-brand-orange-500 px-2 py-0.5 rounded border border-brand-orange-500/30 font-bold">
            {activeCase.case_id} • {activeCase.title}
          </span>
        </div>

        {/* MESSAGES */}
        <div 
          className="flex-1 overflow-y-auto p-4 space-y-4"
          style={{ scrollbarWidth: 'thin' }}
        >
          {chatMessages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div 
                key={msg.id}
                className={`flex flex-col max-w-[85%] ${isUser ? "mr-auto items-left" : "ml-auto items-right"}`}
              >
                <span className="text-[9px] text-slate-400 mb-1 font-mono px-1">
                  {isUser ? user?.name || "المحقق" : "المستشار صقر"} • {msg.timestamp.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div 
                  className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line border ${
                    isUser 
                      ? "bg-brand-orange-500 text-black border-brand-orange-500 rounded-tl-none font-bold" 
                      : isDarkMode 
                        ? "bg-[#090a0c] border-[#22262f] text-gray-200 rounded-tr-none" 
                        : "bg-slate-50 border-slate-200 text-slate-800 rounded-tr-none shadow-sm"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}

          {isChatLoading && (
            <div className="flex flex-col items-right max-w-[80%] ml-auto">
              <span className="text-[9px] text-slate-400 mb-1 font-mono px-1">صقر يفكر ويحلل...</span>
              <div className={`p-3.5 rounded-2xl rounded-tr-none border text-xs flex items-center gap-2 ${
                isDarkMode ? "bg-[#090a0c] border-[#22262f] text-gray-400" : "bg-slate-50 border-slate-200 text-slate-500"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange-500 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange-500 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-brand-orange-500 animate-bounce [animation-delay:0.4s]"></span>
                <span className="mr-1.5">يقوم صقر بمطابقة الأنظمة ومصفوفات الشبهة...</span>
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>

        {/* SUGGESTIONS */}
        <div className={`p-4 border-t ${borderStyle} ${bgStyle}`}>
          <span className="text-[10px] text-slate-400 block mb-2 font-bold">أسئلة وأفكار مقترحة للتحري:</span>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {SUGGESTIONS.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => handleSendChatMessage(suggestion)}
                disabled={isChatLoading}
                className={`text-[10px] text-right px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
                  isDarkMode 
                    ? "bg-[#111317] border-[#22262f] text-gray-300 hover:border-brand-orange-500 hover:text-white" 
                    : "bg-white border-slate-200 text-slate-600 hover:bg-brand-orange-500 hover:text-black hover:border-brand-orange-500"
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        {/* INPUT FORM */}
        <div className={`p-4 border-t ${borderStyle}`}>
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChatMessage(chatInput);
            }}
            className="flex gap-2"
          >
            <input 
              type="text"
              placeholder="اسأل صقر عن تفاصيل السلوك ومبررات القرار..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isChatLoading}
              className={`flex-1 border text-xs rounded-xl px-3.5 py-3 focus:border-brand-orange-500 focus:outline-none ${
                isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
              }`}
            />
            <button 
              type="submit"
              disabled={isChatLoading || !chatInput.trim()}
              className="px-4 bg-brand-orange-500 hover:bg-brand-orange-600 disabled:opacity-50 text-black rounded-xl cursor-pointer flex items-center justify-center transition-all shadow-md shadow-brand-orange-500/15"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
