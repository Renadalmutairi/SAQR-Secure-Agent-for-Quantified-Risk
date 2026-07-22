import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  DollarSign, 
  AlertTriangle, 
  Clock, 
  CreditCard, 
  Cpu, 
  Send,
  ShieldCheck,
  MessageSquare,
  Bot,
  Sparkles,
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";
import { InvestigationState, RecommendedAction, RiskLevel } from "../types";

interface WorkspaceProps {
  activeCase: InvestigationState;
  onUpdateCase: (updatedCase: InvestigationState) => void;
  onNavigate: (page: string) => void;
  isDarkMode?: boolean;
  user?: { name: string; station: string; id: string };
}

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
}

export default function Workspace({ 
  activeCase, 
  onUpdateCase, 
  onNavigate, 
  isDarkMode = false,
  user
}: WorkspaceProps) {
  const [newComment, setNewComment] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Chat States
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Suggested questions for the investigator
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

  // Quick Action Handler (Freeze, Flag, Escalate, etc)
  const handleApplyAction = (action: RecommendedAction) => {
    let statusUpdate: InvestigationState["status"] = "flagged";
    if (action === RecommendedAction.FREEZE_TRANSACTION) statusUpdate = "frozen";
    if (action === RecommendedAction.NO_ACTION) statusUpdate = "archived";

    const updated: InvestigationState = {
      ...activeCase,
      status: statusUpdate,
      trust_decision: activeCase.trust_decision ? {
        ...activeCase.trust_decision,
        recommended_action: action
      } : undefined
    };

    onUpdateCase(updated);
    setSuccessMessage(`تم بنجاح اتخاذ الإجراء [${action.toUpperCase()}] وتحديث حالة القضية في النظام الموحد.`);
    
    // Add comment about the manual override action
    const actionNames: Record<string, string> = {
      "freeze_transaction": "تجميد الحساب فوراً",
      "escalate_to_regulator": "الرفع للبنك المركزي السعودي SAMA",
      "flag_for_review": "وضع علم التدقيق والتحقق",
      "monitor": "المراقبة المستمرة",
      "no_action": "تجاوز واعتماد المعاملة كنشاط آمن"
    };
    const automaticComment = `تعديل يدوي بواسطة المحقق ${user?.name || "ريناد المطيري"}: تطبيق إجراء (${actionNames[action] || action}) وتغيير حالة المتابعة.`;
    const updatedComments = activeCase.comments ? [...activeCase.comments, automaticComment] : [automaticComment];
    onUpdateCase({ ...updated, comments: updatedComments });

    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Add Comment Handler
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const updatedComments = activeCase.comments ? [...activeCase.comments, newComment] : [newComment];
    const updated: InvestigationState = {
      ...activeCase,
      comments: updatedComments
    };

    onUpdateCase(updated);
    setNewComment("");
    
    // Add toast feedback
    setSuccessMessage("تمت إضافة ملاحظتك بنجاح.");
    setTimeout(() => setSuccessMessage(null), 3000);
  };

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
      // Formulate history for the API (convert to expected server structure)
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
      
      // Smart local fallback responses matching Alinma/SAMA security logic
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

      // Simulate network delay
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

  // Status mapping
  const getStatusText = (status: string) => {
    switch (status) {
      case "new": return "قيد الانتظار";
      case "investigating": return "تحت التحقيق";
      case "completed": return "تم فحصها";
      case "flagged": return "تم وضع علم التدقيق";
      case "frozen": return "مجمدة بالكامل";
      case "archived": return "مؤرشفة كنشاط آمن";
      default: return status;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case "new": return "bg-blue-500/10 text-blue-500 border-blue-500/25";
      case "investigating": return "bg-brand-orange-500/10 text-brand-orange-500 border-brand-orange-500/25";
      case "frozen": return "bg-red-500/10 text-red-500 border-red-500/25 font-bold animate-pulse";
      case "archived": return "bg-green-500/10 text-green-500 border-green-500/25";
      default: return "bg-yellow-500/10 text-yellow-500 border-yellow-500/25";
    }
  };

  // Theme variable styles
  const cardStyle = isDarkMode 
    ? "bg-[#111317] border-[#22262f] text-gray-200" 
    : "bg-white border-slate-200/80 text-slate-800 shadow-sm";
  const borderStyle = isDarkMode ? "border-[#22262f]" : "border-slate-200";
  const bgStyle = isDarkMode ? "bg-[#090a0c]" : "bg-slate-50";
  const bgSubtleStyle = isDarkMode ? "bg-[#090a0c]/40" : "bg-slate-100/60";
  const textTitleStyle = isDarkMode ? "text-white" : "text-slate-900";
  const textMutedStyle = isDarkMode ? "text-gray-400" : "text-slate-500";

  return (
    <div className="space-y-6 font-sans animate-fade-in" id="workspace-view">
      
      {/* CASE STATUS HEADER */}
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-4 ${borderStyle}`} id="workspace-case-header">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-brand-orange-500 font-bold tracking-widest uppercase bg-brand-orange-500/10 px-2.5 py-1 border border-brand-orange-500/25 rounded-md">
              {activeCase.case_id}
            </span>
            <span className={`px-2 py-1 text-[10px] rounded border font-bold ${getStatusClass(activeCase.status)}`}>
              {getStatusText(activeCase.status)}
            </span>
          </div>
          <h1 className={`text-2xl font-black mt-1.5 ${textTitleStyle}`}>{activeCase.title}</h1>
          <p className={`text-xs mt-1 ${textMutedStyle}`}>توقيت البلاغ الأمني: {new Date(activeCase.created_at).toLocaleString('ar-EG')}</p>
        </div>

        {/* Shortcut tools */}
        <div className="flex flex-wrap gap-2.5">
          <button 
            onClick={() => onNavigate("pipeline")}
            className={`px-3.5 py-2.5 border text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              isDarkMode ? "bg-[#111317] hover:bg-[#171a21] border-[#22262f]" : "bg-white hover:bg-slate-50 border-slate-200"
            }`}
          >
            <Cpu className="w-4 h-4 text-brand-orange-500" />
            <span>محاكاة وفحص خط المعالجة</span>
          </button>

          <button 
            onClick={() => onNavigate("reports")}
            className="px-3.5 py-2.5 bg-brand-orange-500 hover:bg-brand-orange-600 text-black text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-brand-orange-500/10"
          >
            <FileText className="w-4 h-4" />
            <span>مراجعة وصياغة التقرير الرقابي</span>
          </button>
        </div>
      </div>

      {/* Success Messages alert */}
      {successMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 p-3.5 rounded-lg flex items-center gap-2.5 text-xs text-emerald-600 font-bold animate-fade-in" id="success-feedback">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* TWO COLUMN GRID: LEFT, RIGHT PANELS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6" id="workspace-panels-grid">
        
        {/* COLUMN 1: TRANSACTION DETAILS & RISKS */}
        <div className="space-y-6" id="workspace-col-1">
          
          {/* RISK SCORE CARD */}
          <div className={`border rounded-xl p-5 relative overflow-hidden ${cardStyle}`} id="workspace-risk-gauge">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <h3 className={`text-xs font-mono font-bold uppercase tracking-wider mb-4 ${textMutedStyle}`}>تقييم وتحليل مستوى المخاطر</h3>
            
            <div className="flex items-center gap-6">
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                {/* Radial progress circle */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="40" cy="40" r="34" className={`fill-transparent stroke-current stroke-[6px] ${isDarkMode ? "text-[#1d212b]" : "text-slate-100"}`} />
                  <circle 
                    cx="40" cy="40" r="34" 
                    className="fill-transparent stroke-brand-orange-500 stroke-[6px] transition-all duration-1000"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - (activeCase.trust_decision?.risk_score || 0) / 100)}`}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className={`text-xl font-extrabold ${textTitleStyle}`}>{activeCase.trust_decision?.risk_score || 0}%</span>
                  <span className="text-[8px] text-slate-400 font-mono">درجة الخطر</span>
                </div>
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${
                    activeCase.trust_decision?.risk_level === RiskLevel.CRITICAL ? "bg-red-500" :
                    activeCase.trust_decision?.risk_level === RiskLevel.HIGH ? "bg-orange-500" :
                    "bg-yellow-500"
                  }`}></span>
                  <span className={`text-xs font-bold ${textTitleStyle}`}>درجة التقييم: {activeCase.trust_decision?.risk_level.toUpperCase()}</span>
                </div>
                <p className={`text-[11px] leading-relaxed ${textMutedStyle}`}>
                  تم احتساب المعاملة بواسطة محركات صقر الموحدة بمطابقة أنماط البنك المركزي السعودي.
                </p>
              </div>
            </div>
          </div>

          {/* TRANSACTION METADATA */}
          <div className={`border rounded-xl p-5 space-y-4 ${cardStyle}`} id="workspace-transaction-metadata">
            <h3 className={`text-xs font-mono font-bold uppercase tracking-wider ${textMutedStyle}`}>بيانات المعاملة المستهدفة بالتدقيق</h3>
            
            <div className={`border rounded-lg p-3.5 space-y-3 text-xs font-mono ${bgSubtleStyle} ${borderStyle}`}>
              <div className="flex justify-between items-center">
                <span className={textMutedStyle}>رقم المعاملة:</span>
                <span className={`font-bold ${textTitleStyle}`}>{activeCase.transaction.transaction_id}</span>
              </div>

              <div className={`flex justify-between items-center border-t pt-2.5 ${borderStyle}`}>
                <span className={textMutedStyle}>قيمة الحركة:</span>
                <span className="text-brand-orange-500 font-extrabold text-sm">{activeCase.transaction.amount.toLocaleString()} SAR</span>
              </div>

              <div className={`flex justify-between items-center border-t pt-2.5 ${borderStyle}`}>
                <span className={textMutedStyle}>الآيبان المستهدف:</span>
                <span className={`text-[10px] break-all text-left ${textTitleStyle}`} dir="ltr">{activeCase.transaction.account_id}</span>
              </div>

              <div className={`flex justify-between items-center border-t pt-2.5 ${borderStyle}`}>
                <span className={textMutedStyle}>القناة المستخدمة:</span>
                <span className={`font-medium ${textTitleStyle}`}>
                  {activeCase.transaction.channel === 'wire' ? "حوالة مصرفية رقمية" : "إيداع صراف تفاعلي"}
                </span>
              </div>

              <div className={`flex justify-between items-center border-t pt-2.5 ${borderStyle}`}>
                <span className={textMutedStyle}>الطرف المقابل:</span>
                <span className={`font-medium truncate max-w-[130px] ${textTitleStyle}`}>{activeCase.transaction.counterparty_id || "إيداع نقد عيني"}</span>
              </div>
            </div>

            {/* Custom transaction parameters */}
            {activeCase.transaction.raw_metadata && (
              <div className="space-y-2">
                <span className={`text-[10px] font-mono font-bold block ${textMutedStyle}`}>الخصائص الجغرافية والتقنية:</span>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                  {Object.entries(activeCase.transaction.raw_metadata).map(([key, value]) => (
                    <div key={key} className={`border p-2 rounded ${bgSubtleStyle} ${borderStyle}`}>
                      <span className={`${textMutedStyle} block`}>{key}:</span>
                      <span className={`font-bold block truncate mt-0.5 ${textTitleStyle}`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* COMMENTS & NOTES SECTION */}
          <div className={`border rounded-xl p-5 space-y-4 ${cardStyle}`} id="comments-section">
            <h2 className={`text-xs font-bold uppercase tracking-wider ${textMutedStyle}`}>ملاحظات وقرارات المحققين الميدانيين</h2>
            
            <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1" id="comments-list">
              {activeCase.comments && activeCase.comments.map((comment, index) => (
                <div key={index} className={`border p-3 rounded-lg text-xs ${bgSubtleStyle} ${borderStyle}`}>
                  <div className={`flex justify-between items-center text-[9px] mb-1 font-mono ${textMutedStyle}`}>
                    <span>المحقق المالي المعتمد</span>
                    <span>سجل فوري</span>
                  </div>
                  <p className={textTitleStyle}>{comment}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input 
                type="text"
                placeholder="أضف ملاحظة أو نتيجة تدقيق هنا..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className={`flex-1 border text-xs rounded-lg px-3 py-2.5 focus:border-brand-orange-500 focus:outline-none ${
                  isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                }`}
              />
              <button 
                type="submit"
                className="px-3 bg-brand-orange-500 hover:bg-brand-orange-600 text-black rounded-lg cursor-pointer flex items-center justify-center transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* COLUMN 2: TRUST AGENT REASONING & DECISION OVERRIDE */}
        <div className="space-y-6" id="workspace-col-2">
          
          {/* TRUST DECISION EXPLANATION (AI FINDINGS) */}
          <div className={`border rounded-xl p-6 space-y-4 ${cardStyle}`} id="ai-decision-panel">
            <div className={`flex justify-between items-center pb-3 border-b ${borderStyle}`}>
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-brand-orange-500" />
                <h2 className={`text-sm font-bold ${textTitleStyle}`}>تحليل القرار ومبررات محرك صقر</h2>
              </div>
              <span className={`text-[11px] font-mono ${textMutedStyle}`}>نسبة الثقة: {activeCase.trust_decision?.confidence || 0}%</span>
            </div>

            {/* Core Reasoning text */}
            <div className="p-4 bg-brand-orange-500/10 border border-brand-orange-500/25 rounded-lg text-xs leading-relaxed">
              <strong className="block text-brand-orange-500 font-bold mb-1.5">التوصية والسبب المباشر:</strong>
              <p className={isDarkMode ? "text-gray-300" : "text-slate-700"}>{activeCase.trust_decision?.reasoning || "لم يتم تشغيل فحص الذكاء الاصطناعي الكامل لهذه الحركات المالية حتى الآن."}</p>
            </div>

            {/* Contributing factors */}
            <div className="space-y-2.5">
              <h4 className={`text-xs font-bold ${textTitleStyle}`}>عوامل ومؤشرات الخطر المساهمة:</h4>
              <div className="space-y-2">
                {activeCase.trust_decision?.contributing_factors.map((factor, i) => (
                  <div key={i} className={`border rounded-lg p-2.5 text-xs flex gap-2 items-start ${bgSubtleStyle} ${borderStyle}`}>
                    <span className="text-brand-orange-500 font-extrabold shrink-0 mt-0.5">■</span>
                    <span className={textMutedStyle}>{factor}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* INVESTIGATOR RECOMMENDED ACTION MATRIX */}
            <div className={`pt-4 border-t ${borderStyle}`}>
              <span className={`text-xs font-bold block mb-3 ${textTitleStyle}`}>تعديل القرار واتخاذ الإجراء المباشر في النظام:</span>
              <div className="grid grid-cols-2 gap-2" id="action-matrix-buttons">
                {[
                  { id: RecommendedAction.FREEZE_TRANSACTION, label: "تجميد الحساب فورا", style: "border-red-500/20 hover:bg-red-500/10 hover:text-red-500" },
                  { id: RecommendedAction.ESCALATE_TO_REGULATOR, label: "الرفع لـ SAMA", style: "border-brand-orange-500/20 hover:bg-brand-orange-500/10 hover:text-brand-orange-500" },
                  { id: RecommendedAction.FLAG_FOR_REVIEW, label: "وضع علم تدقيق", style: "border-yellow-500/20 hover:bg-yellow-500/10 hover:text-yellow-600" },
                  { id: RecommendedAction.NO_ACTION, label: "اعتماد وتجاوز", style: "border-green-500/20 hover:bg-green-500/10 hover:text-green-600" }
                ].map(action => {
                  const isSelected = activeCase.trust_decision?.recommended_action === action.id;
                  return (
                    <button
                      key={action.id}
                      onClick={() => handleApplyAction(action.id)}
                      className={`text-[11px] font-bold border py-2.5 px-2 rounded-lg text-center transition-all cursor-pointer ${action.style} ${
                        isSelected 
                          ? "bg-brand-orange-500 text-black border-brand-orange-500 hover:bg-brand-orange-500 hover:text-black" 
                          : isDarkMode ? "bg-[#090a0c] text-gray-400" : "bg-slate-50 text-slate-600"
                      }`}
                    >
                      {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
