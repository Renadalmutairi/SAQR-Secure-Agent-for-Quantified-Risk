import React, { useState } from "react";
import { 
  ShieldAlert, 
  Clock, 
  CheckCircle, 
  ArrowUpRight, 
  AlertOctagon, 
  Eye 
} from "lucide-react";
import { InvestigationState, RiskLevel, RecommendedAction, Alert } from "../types";

interface DashboardProps {
  cases: InvestigationState[];
  alerts: Alert[];
  onSelectCase: (caseId: string) => void;
  onNavigate: (page: string) => void;
  isDarkMode?: boolean;
}

export default function Dashboard({ cases, alerts, onSelectCase, onNavigate, isDarkMode = false }: DashboardProps) {
  const [filterRisk, setFilterRisk] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [activeMetricTab, setActiveMetricTab] = useState<number>(0);

  // Calculations for the 4 key questions
  const activeCases = cases.filter(c => c.status !== "archived");
  const completedCases = cases.filter(c => c.status === "archived");
  const criticalRiskCount = cases.filter(c => c.trust_decision?.risk_level === RiskLevel.CRITICAL).length;
  const highRiskCount = cases.filter(c => c.trust_decision?.risk_level === RiskLevel.HIGH).length;
  const mediumRiskCount = cases.filter(c => c.trust_decision?.risk_level === RiskLevel.MEDIUM).length;

  const totalFlaggedCount = cases.filter(c => c.trust_decision?.recommended_action === RecommendedAction.FLAG_FOR_REVIEW).length;
  const totalFreezeCount = cases.filter(c => c.trust_decision?.recommended_action === RecommendedAction.FREEZE_TRANSACTION).length;
  const totalEscalateCount = cases.filter(c => c.trust_decision?.recommended_action === RecommendedAction.ESCALATE_TO_REGULATOR).length;

  // Filter cases for display
  const filteredCases = activeCases.filter(c => {
    if (filterRisk !== "all" && c.trust_decision?.risk_level !== filterRisk) return false;
    if (filterAction !== "all" && c.trust_decision?.recommended_action !== filterAction) return false;
    return true;
  });

  // Theme variable styles
  const cardStyle = isDarkMode 
    ? "bg-[#111317] border-[#22262f] text-gray-200" 
    : "bg-white border-slate-200/80 text-slate-800 shadow-sm";
  const borderStyle = isDarkMode ? "border-[#22262f]" : "border-slate-200";
  const bgStyle = isDarkMode ? "bg-[#090a0c]" : "bg-slate-50";
  const bgSubtleStyle = isDarkMode ? "bg-[#090a0c]/50" : "bg-slate-100/50";
  const textTitleStyle = isDarkMode ? "text-white" : "text-slate-900";
  const textMutedStyle = isDarkMode ? "text-gray-400" : "text-slate-500";

  // Data mapping for 4 clickable metrics
  const metricTabs = [
    {
      id: 0,
      title: "التحقيقات النشطة",
      badge: `${activeCases.length} قضايا`,
      subtitle: "ما هي التحقيقات الجارية الآن؟",
      icon: <Clock className="w-5 h-5" />,
      details: (
        <div className="space-y-4 font-sans animate-fade-in">
          <div className="flex justify-between items-baseline">
            <span className="text-xs md:text-sm font-medium text-slate-400">إجمالي التحقيقات المفتوحة الجارية:</span>
            <span className="text-3xl font-extrabold text-brand-orange-500">{activeCases.length} قضايا</span>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            تمت مطابقة وفحص {cases.length} قضية إجمالاً، حيث تم أرشفة {completedCases.length} قضية تلقائياً بعد استيفاء شروط الالتزام المحددة من البنك المركزي السعودي لمكافحة العمليات غير الاعتيادية.
          </p>
          <div className="bg-[#090a0c]/10 dark:bg-[#090a0c]/40 p-3 rounded-lg border border-current/5 flex justify-between items-center text-xs">
            <span className="text-slate-400">مكتملة ومؤرشفة كنشاط آمن:</span>
            <span className="font-mono font-bold text-brand-orange-500">{completedCases.length} قضايا</span>
          </div>
        </div>
      )
    },
    {
      id: 1,
      title: "مصفوفة المخاطر",
      badge: `${criticalRiskCount + highRiskCount} خطرة جداً`,
      subtitle: "ما هي الحالات ذات الخطورة الأعلى؟",
      icon: <ShieldAlert className="w-5 h-5" />,
      details: (
        <div className="space-y-4 font-sans animate-fade-in">
          <div className="flex justify-between items-baseline">
            <span className="text-xs md:text-sm font-medium text-slate-400">العمليات مرتفعة وحرجة الخطورة:</span>
            <span className="text-3xl font-extrabold text-red-500">{criticalRiskCount + highRiskCount} قضايا</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className={`border p-3 rounded-lg flex items-center justify-between ${borderStyle}`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="font-medium text-slate-300">الدرجة الحرجة:</span>
              </div>
              <span className="font-bold font-mono text-red-500">{criticalRiskCount}</span>
            </div>
            <div className={`border p-3 rounded-lg flex items-center justify-between ${borderStyle}`}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                <span className="font-medium text-slate-300">الدرجة المرتفعة:</span>
              </div>
              <span className="font-bold font-mono text-orange-500">{highRiskCount}</span>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-slate-400">
            يقوم نظام صقر الأكاديمي بإسناد الحركات تلقائياً لدرجات الخطورة بمطابقة البصمات السلوكية الجغرافية وقوانين الالتزام.
          </p>
        </div>
      )
    },
    {
      id: 2,
      title: "مسببات الشبهة",
      badge: "تحليل الأنماط",
      subtitle: "ما هي الأسباب والمؤشرات الأساسية للمخاطر؟",
      icon: <AlertOctagon className="w-5 h-5" />,
      details: (
        <div className="space-y-3 font-sans animate-fade-in text-xs text-slate-400">
          <div className="flex justify-between items-center py-2 border-b border-current/5">
            <span>تجزئة الودائع وتفتيت السيولة (Structuring):</span>
            <span className="font-mono text-yellow-500 font-bold">٢ قضية نشطة</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-current/5">
            <span>اختراق واستيلاء على حساب خامل (Account Takeover):</span>
            <span className="font-mono text-red-500 font-bold">١ قضية نشطة</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span>انحراف البصمة السلوكية الفردية (DNA Deviation):</span>
            <span className="font-mono text-brand-orange-500 font-bold">٩٤٪ أقصى انحراف سلوكي</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            تم رصد مسببات الشبهة آلياً بواسطة نماذج الذكاء الاصطناعي المستقلة لتأكيد كفاءة كشف غسيل الأموال.
          </p>
        </div>
      )
    },
    {
      id: 3,
      title: "الإجراء الموصى به",
      badge: "توصيات فورية",
      subtitle: "ما هي الإجراءات المطلوبة فوراً للحماية؟",
      icon: <CheckCircle className="w-5 h-5" />,
      details: (
        <div className="space-y-4 font-sans animate-fade-in">
          <span className="text-xs font-bold text-slate-300 block mb-2">الإجراءات المقترحة لحماية العمليات المالية بمصرف الإنماء:</span>
          <div className="flex flex-wrap gap-2.5">
            <span className={`text-xs px-3 py-1.5 border rounded-lg font-bold text-red-400 flex items-center gap-1.5 ${isDarkMode ? "bg-red-950/40 border-red-500/20" : "bg-red-50 border-red-200 text-red-600"}`}>
              <span>تجميد فوري:</span>
              <strong className="font-mono text-sm">{totalFreezeCount}</strong>
            </span>
            <span className={`text-xs px-3 py-1.5 border rounded-lg font-bold text-brand-orange-500 flex items-center gap-1.5 ${isDarkMode ? "bg-brand-orange-950/40 border-brand-orange-500/20" : "bg-brand-orange-50 border-brand-orange-200 text-brand-orange-600"}`}>
              <span>رفع للبنك المركزي SAMA:</span>
              <strong className="font-mono text-sm">{totalEscalateCount}</strong>
            </span>
            <span className={`text-xs px-3 py-1.5 border rounded-lg font-bold text-yellow-500 flex items-center gap-1.5 ${isDarkMode ? "bg-yellow-950/40 border-yellow-500/20" : "bg-yellow-50 border-yellow-200 text-yellow-600"}`}>
              <span>طلب مستندات إضافية:</span>
              <strong className="font-mono text-sm">{totalFlaggedCount}</strong>
            </span>
          </div>
          <p className="text-[10px] text-slate-500">
            تتطلب الإجراءات الحرجة (مثل التجميد) مراجعة يدوية وتوقيعاً رقمياً معتمداً من المحقق المالي لتفعيلها بمصرف الإنماء.
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8 font-sans animate-fade-in" id="dashboard-view">
      {/* HEADER SECTION with Command Center style */}
      <div className={`flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 gap-4 ${borderStyle}`} id="dashboard-header">
        <div>
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-orange-500 animate-pulse glow-orange"></span>
            <span className={`text-xs font-mono tracking-widest uppercase ${textMutedStyle}`}>SAQR SECURITY LAYER v2.8 • Alinma Bank</span>
          </div>
          <h1 className={`text-3xl font-extrabold tracking-tight mt-1 ${textTitleStyle}`}>مركز القيادة والمراقبة المالي</h1>
          <p className={`text-sm mt-1 ${textMutedStyle}`}>طبقة الاستخبارات والذكاء الاصطناعي لحماية ومراقبة الحركات البنكية الحكومية</p>
        </div>
        <div className={`flex items-center gap-3 border rounded-lg px-4 py-2 text-xs font-mono ${cardStyle}`}>
          <Clock className="w-4 h-4 text-brand-orange-500" />
          <span>آخر تحديث تلقائي: {new Date().toLocaleTimeString('ar-EG')}</span>
        </div>
      </div>

      {/* COMPACT INTERACTIVE ICON TABS SELECTOR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="metric-icons-selector">
        {metricTabs.map((tab) => {
          const isActive = activeMetricTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveMetricTab(tab.id)}
              className={`p-4 border rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer relative ${
                isActive
                  ? "border-brand-orange-500 bg-brand-orange-500/5 shadow-md scale-[1.02]"
                  : isDarkMode
                    ? "bg-[#111317] border-[#22262f] text-gray-400 hover:bg-[#171a21] hover:text-white"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {/* Highlight Circle behind active icon */}
              <div className={`p-2.5 rounded-lg mb-2 transition-colors ${
                isActive 
                  ? "bg-brand-orange-500/20 text-brand-orange-500" 
                  : isDarkMode ? "bg-[#090a0c] text-gray-400" : "bg-slate-50 text-slate-500"
              }`}>
                {tab.icon}
              </div>
              <span className={`text-xs font-bold block ${isActive ? "text-brand-orange-500 font-extrabold" : "text-slate-400"}`}>
                {tab.title}
              </span>
              <span className="text-[9px] font-mono mt-1 opacity-70 block">
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* DETAILED INFORMATION BOX OF SELECTED ICON */}
      <div className={`border rounded-2xl p-6 ${cardStyle}`} id="selected-metric-details-container">
        <div className="flex justify-between items-start pb-4 border-b border-current/10 mb-4">
          <div>
            <span className="text-[9px] font-mono uppercase text-brand-orange-500 tracking-wider">الاستخبارات والتحليلات الجنائية الرقمية</span>
            <h2 className={`text-base font-black ${textTitleStyle}`}>
              {metricTabs[activeMetricTab].subtitle}
            </h2>
          </div>
          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border rounded ${isDarkMode ? "bg-[#090a0c] border-[#22262f]" : "bg-slate-50 border-slate-200"}`}>
            تفاصيل المؤشر النشط
          </span>
        </div>
        {metricTabs[activeMetricTab].details}
      </div>

      {/* ALERTS & QUICK ACTIONS BENTO GRID */}
      <div className="grid grid-cols-1 gap-6" id="alerts-grid-container">
        
        {/* LIVE INVESTIGATION ALERTS (EXPANDED TO FULL WIDTH) */}
        <div className={`border rounded-xl p-6 ${cardStyle}`} id="alerts-panel">
          <div className={`flex justify-between items-center mb-4 pb-3 border-b ${borderStyle}`}>
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
              <h2 className={`text-base font-bold ${textTitleStyle}`}>التنبيهات الفورية وبلاغات النظام</h2>
            </div>
            <span className={`text-xs font-mono ${textMutedStyle}`}>عدد {alerts.length} تنبيهات فاعلة</span>
          </div>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1" id="alerts-list">
            {alerts.map((alert) => (
              <div 
                key={alert.id}
                className={`flex gap-3.5 p-3.5 rounded-lg border transition-all duration-200 cursor-pointer ${
                  alert.unread 
                    ? "bg-brand-orange-50/5 border-brand-orange-500/30" 
                    : `${isDarkMode ? "bg-[#090a0c]/50 border-[#22262f] hover:bg-[#111317]" : "bg-slate-50 border-slate-200/60 hover:bg-slate-100/50"}`
                }`}
                onClick={() => onSelectCase(alert.case_id)}
              >
                <div className="mt-1 flex-shrink-0">
                  {alert.severity === "critical" ? (
                    <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 glow-orange"></span>
                  ) : (
                    <span className="flex h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-4">
                    <p className={`text-xs ${alert.unread ? `${textTitleStyle} font-bold` : textMutedStyle}`}>
                      {alert.message}
                    </p>
                    <span className={`text-[10px] font-mono shrink-0 ${textMutedStyle}`}>
                      {new Date(alert.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center mt-2">
                    <span className={`text-[10px] font-mono border px-2 py-0.5 rounded ${
                      isDarkMode ? "bg-[#090a0c] border-[#22262f] text-brand-orange-400" : "bg-white border-slate-200 text-brand-orange-500"
                    }`}>
                      {alert.case_id}
                    </span>
                    <span className={`text-[10px] ${textMutedStyle}`}>مصدر التنبيه: صقر AML-Engine</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CASES WORKSPACE OVERVIEW TABLE */}
      <div className={`border rounded-xl p-6 ${cardStyle}`} id="cases-table-panel">
        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b ${borderStyle}`}>
          <div>
            <h2 className={`text-lg font-bold ${textTitleStyle}`}>جدول قضايا التحقيق والاشتباه النشطة</h2>
            <p className={`text-xs mt-0.5 ${textMutedStyle}`}>انقر على أي قضية لفتح بيئة عمل المحقق المتكاملة والبدء في الإجراءات</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Filter by Risk Level */}
            <div className="flex items-center gap-2">
              <span className={`text-xs ${textMutedStyle}`}>المخاطر:</span>
              <select 
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className={`border text-xs rounded px-2.5 py-1.5 focus:border-brand-orange-500 focus:outline-none ${
                  isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-white border-slate-200 text-slate-800"
                }`}
              >
                <option value="all">الكل</option>
                <option value="critical">حرجة جداً (Critical)</option>
                <option value="high">مرتفعة (High)</option>
                <option value="medium">متوسطة (Medium)</option>
                <option value="low">منخبار منخفضة (Low)</option>
              </select>
            </div>

            {/* Filter by Recommended Action */}
            <div className="flex items-center gap-2">
              <span className={`text-xs ${textMutedStyle}`}>الإجراء:</span>
              <select 
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className={`border text-xs rounded px-2.5 py-1.5 focus:border-brand-orange-500 focus:outline-none ${
                  isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-white border-slate-200 text-slate-800"
                }`}
              >
                <option value="all">الكل</option>
                <option value="freeze_transaction">تجميد فوري</option>
                <option value="escalate_to_regulator">رفع للبنك المركزي</option>
                <option value="flag_for_review">مراجعة والطلب من العميل</option>
                <option value="no_action">اعتماد وتجاوز تلقائي</option>
              </select>
            </div>
          </div>
        </div>

        {filteredCases.length === 0 ? (
          <div className={`text-center py-12 border border-dashed rounded-lg ${isDarkMode ? "border-[#22262f] bg-[#090a0c]/20" : "border-slate-200 bg-slate-50"} ${textMutedStyle}`}>
            <AlertOctagon className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-sm">لا توجد قضايا مطابقة للمعايير المحددة حالياً.</p>
          </div>
        ) : (
          <div className="overflow-x-auto" id="cases-data-table">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className={`border-b text-slate-400 font-medium ${borderStyle}`}>
                  <th className="pb-3 text-right">رقم القضية</th>
                  <th className="pb-3 text-right">المستهدف / الحساب</th>
                  <th className="pb-3 text-right">القيمة المحولة</th>
                  <th className="pb-3 text-right">انحراف السلوك (DNA)</th>
                  <th className="pb-3 text-right">مستوى الخطورة</th>
                  <th className="pb-3 text-right">الإجراء الموصى به</th>
                  <th className="pb-3 text-left">التحكم</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? "divide-[#22262f]/40" : "divide-slate-100"}`}>
                {filteredCases.map((c) => {
                  const isCritical = c.trust_decision?.risk_level === RiskLevel.CRITICAL;
                  const isHigh = c.trust_decision?.risk_level === RiskLevel.HIGH;
                  const isMedium = c.trust_decision?.risk_level === RiskLevel.MEDIUM;

                  let riskBadge = "bg-green-500/10 text-green-500 border-green-500/20";
                  if (isCritical) riskBadge = "bg-red-500/10 text-red-500 border-red-500/20 font-bold animate-pulse";
                  else if (isHigh) riskBadge = "bg-orange-500/10 text-orange-500 border-orange-500/20";
                  else if (isMedium) riskBadge = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";

                  let actionText = "متابعة الحساب";
                  let actionBadge = isDarkMode ? "bg-[#090a0c] text-gray-400 border-[#22262f]" : "bg-slate-50 text-slate-500 border-slate-200";
                  if (c.trust_decision?.recommended_action === RecommendedAction.FREEZE_TRANSACTION) {
                    actionText = "تجميد الحساب فورا";
                    actionBadge = "bg-red-500/10 text-red-500 border-red-500/20";
                  } else if (c.trust_decision?.recommended_action === RecommendedAction.ESCALATE_TO_REGULATOR) {
                    actionText = "رفع للبنك المركزي SAMA";
                    actionBadge = "bg-brand-orange-500/10 text-brand-orange-500 border-brand-orange-500/20";
                  } else if (c.trust_decision?.recommended_action === RecommendedAction.FLAG_FOR_REVIEW) {
                    actionText = "طلب مستندات العميل";
                    actionBadge = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
                  }

                  return (
                    <tr key={c.case_id} className={`transition-colors group ${isDarkMode ? "hover:bg-[#090a0c]/40" : "hover:bg-slate-50"}`}>
                      <td className="py-4 font-mono text-brand-orange-500 font-semibold">{c.case_id}</td>
                      <td className="py-4">
                        <div>
                          <div className={`font-bold group-hover:text-brand-orange-500 transition-colors ${textTitleStyle}`}>{c.title}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{c.transaction.account_id}</div>
                        </div>
                      </td>
                      <td className="py-4">
                        <div className={`font-mono font-bold ${textTitleStyle}`}>
                          {c.transaction.amount.toLocaleString()} <span className="text-[10px] text-slate-400">SAR</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{c.transaction.channel === 'wire' ? 'حوالة سريعة' : 'إيداع صراف'}</span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-12 h-2 rounded-full overflow-hidden border ${isDarkMode ? "bg-[#090a0c] border-[#22262f]" : "bg-slate-100 border-slate-200"}`}>
                            <div 
                              className="bg-brand-orange-500 h-full" 
                              style={{ width: `${(c.dna_fingerprint?.deviation_score || 0) * 100}%` }}
                            ></div>
                          </div>
                          <span className={`font-mono font-semibold ${textTitleStyle}`}>
                            {Math.round((c.dna_fingerprint?.deviation_score || 0) * 100)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 text-[10px] rounded border ${riskBadge}`}>
                          {c.trust_decision?.risk_level.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`px-2 py-1 text-[10px] rounded border ${actionBadge}`}>
                          {actionText}
                        </span>
                      </td>
                      <td className="py-4 text-left">
                        <button 
                          onClick={() => onSelectCase(c.case_id)}
                          className={`px-3 py-1.5 border rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ml-0 ${
                            isDarkMode 
                              ? "bg-[#090a0c] hover:bg-brand-orange-500 hover:text-black border-[#22262f]" 
                              : "bg-white hover:bg-brand-orange-500 hover:text-black border-slate-200"
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>فتح الملف</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
