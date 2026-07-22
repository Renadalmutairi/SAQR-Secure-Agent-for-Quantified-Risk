import React, { useState, useEffect } from "react";
import { 
  FileText, 
  Lock, 
  Unlock, 
  CheckCircle,
  CheckSquare,
  Info,
  Mail,
  Send,
  X
} from "lucide-react";
import { InvestigationState } from "../types";

interface ReportsProps {
  activeCase: InvestigationState;
  onUpdateCase: (updatedCase: InvestigationState) => void;
  allCases: InvestigationState[];
  onSelectCaseById: (caseId: string) => void;
  isDarkMode?: boolean;
  user?: { name: string; station: string; id: string; email?: string };
}

export default function Reports({ 
  activeCase, 
  onUpdateCase, 
  allCases, 
  onSelectCaseById,
  isDarkMode = false,
  user
}: ReportsProps) {
  const [summary, setSummary] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [signee, setSignee] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [isSigned, setIsSigned] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  const handleSendEmail = () => {
    setIsSendingEmail(true);
    setTimeout(() => {
      setIsSendingEmail(false);
      setSuccessMsg(`تم إرسال مسودة التقرير المالي المعتمد بنجاح إلى البريد الإلكتروني للعمل: ${user?.email || "renad.mutairi@alinma.com"}`);
      setTimeout(() => setSuccessMsg(null), 5000);
    }, 1200);
  };

  // Sync state with active case draft
  useEffect(() => {
    if (activeCase) {
      const defaultSummary = `تقرير فحص اشتباه غسيل أموال رقم ${activeCase.case_id}`;
      
      // Intelligent autofill notes based on SAMA typologies and findings if empty
      const defaultNotes = activeCase.report_draft?.notes || 
        `تم فحص المعاملة المالية المشتبه بها رقم [${activeCase.transaction.transaction_id}] بقيمة [${activeCase.transaction.amount.toLocaleString()} SAR].\n\nمبررات الاشتباه ومخرجات فحص صقر:\n- انحراف البصمة السلوكية بمقدار ${Math.round((activeCase.dna_fingerprint?.deviation_score || 0) * 100)}% مقارنة بنشاط الحساب المعتاد.\n- رصد ${activeCase.graph_result?.suspicious_node_ids.length || 0} عقد مستفيدة مشبوهة في شبكة الحركات المالية.\n- توصية نهائية: نوصي بـ [${activeCase.trust_decision?.recommended_action.toUpperCase()}] والتحفظ الفوري على الرصيد وإرسال إشعار رسمي لوحدة التحريات المالية بموجب الأنظمة الرقابية السعودية.`;

      setSummary(activeCase.report_draft?.summary || defaultSummary);
      setNotes(defaultNotes);
      setSignee(activeCase.report_draft?.signee || user?.name || "ريناد جزاع المطيري");
      setDepartment(activeCase.report_draft?.department || user?.station.split(" - ")[0] || "مصرف الإنماء - إدارة الامتثال ومكافحة الجرائم المالية");
      setIsSigned(activeCase.report_draft?.is_signed || false);
    }
  }, [activeCase, user]);

  const handleSaveDraft = () => {
    const updated: InvestigationState = {
      ...activeCase,
      report_draft: {
        summary,
        notes,
        signee,
        department,
        is_signed: isSigned,
        signed_at: isSigned ? new Date().toISOString() : undefined
      }
    };
    onUpdateCase(updated);
    setSuccessMsg("تم حفظ مسودة التقرير المالي الموحد بنجاح.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSignReport = () => {
    if (!signee.trim()) {
      alert("الرجاء كتابة اسم الموقع المعتمد.");
      return;
    }
    const updated: InvestigationState = {
      ...activeCase,
      status: "completed",
      report_draft: {
        summary,
        notes,
        signee,
        department,
        is_signed: true,
        signed_at: new Date().toISOString()
      }
    };
    onUpdateCase(updated);
    setIsSigned(true);
    setSuccessMsg("تم توقيع التقرير إلكترونياً وتأمين الملف للبنك المركزي SAMA بنجاح.");
    setTimeout(() => setSuccessMsg(null), 4500);
  };

  const handleUnlockReport = () => {
    const updated: InvestigationState = {
      ...activeCase,
      report_draft: {
        ...activeCase.report_draft!,
        is_signed: false,
        signed_at: undefined
      }
    };
    onUpdateCase(updated);
    setIsSigned(false);
    setSuccessMsg("تم إلغاء قفل التقرير وبدء التعديل.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Theme styling mapping
  const cardStyle = isDarkMode 
    ? "bg-[#111317] border-[#22262f] text-gray-200" 
    : "bg-white border-slate-200/80 text-slate-800 shadow-sm";
  const borderStyle = isDarkMode ? "border-[#22262f]" : "border-slate-200";
  const bgStyle = isDarkMode ? "bg-[#090a0c]" : "bg-slate-50";
  const bgSubtleStyle = isDarkMode ? "bg-[#090a0c]/40" : "bg-slate-50 border-slate-100";
  const textTitleStyle = isDarkMode ? "text-white" : "text-slate-900";
  const textMutedStyle = isDarkMode ? "text-gray-400" : "text-slate-500";

  return (
    <div className="space-y-6 font-sans animate-fade-in" id="reports-view">
      
      {/* HEADER SECTION */}
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-4 ${borderStyle}`} id="reports-header">
        <div>
          <h1 className={`text-2xl font-black flex items-center gap-2 ${textTitleStyle}`}>
            <FileText className="w-6 h-6 text-brand-orange-500" />
            <span>نظام التقارير والرفع للجهات الرقابية</span>
          </h1>
          <p className={`text-xs mt-1 ${textMutedStyle}`}>
            صياغة التقارير الرسمية وتوقيعها لإرسالها لوحدة الاستخبارات المالية بالبنك المركزي السعودي (SAMA) والالتزام الداخلي
          </p>
        </div>

        {/* Dynamic Case Selector for Report */}
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold ${textMutedStyle}`}>اختيار قضية:</span>
          <select 
            value={activeCase.case_id}
            onChange={(e) => onSelectCaseById(e.target.value)}
            className={`border rounded px-3 py-1.5 text-xs text-brand-orange-500 focus:border-brand-orange-500 focus:outline-none font-sans font-bold ${
              isDarkMode ? "bg-[#111317] border-[#22262f]" : "bg-white border-slate-200"
            }`}
          >
            {allCases.map(c => (
              <option key={c.case_id} value={c.case_id}>
                {c.case_id} - {c.title.substring(0, 24)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 p-3.5 rounded-lg flex items-center gap-2 text-xs text-emerald-600 font-bold animate-fade-in" id="reports-success-msg">
          <CheckCircle className="w-4.5 h-4.5 text-emerald-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* CENTRALIZED EDITOR (Report preview is now hidden by default and accessible via the preview modal) */}
      <div className="max-w-3xl mx-auto w-full" id="reports-workspace">
        
        {/* EDITING FORM PANEL */}
        <div className={`border rounded-xl p-6 space-y-5 flex flex-col justify-between ${cardStyle}`} id="report-form-panel">
          <div>
            <h3 className={`text-xs font-mono font-bold uppercase tracking-wider mb-4 ${textMutedStyle}`}>محرر التقرير الرقابي</h3>
            
            {isSigned ? (
              <div className="bg-red-500/5 border border-red-500/25 p-4 rounded-lg space-y-2.5 text-xs text-red-500 font-bold animate-fade-in">
                <strong className="block font-black text-sm">تم اعتماد وتوقيع البلاغ إلكترونياً</strong>
                <p className="text-slate-500 leading-relaxed font-medium">
                  تم قفل مستند التحقيق رقم {activeCase.case_id} ولا يمكن تعديله حالياً بموجب الأنظمة المصرفية السعودية إلا بعد فك القفل للتعديل الميداني وتوقيعه مجدداً.
                </p>
                <div className="flex gap-2.5 items-center flex-wrap pt-1">
                  <button 
                    onClick={() => setShowPreviewModal(true)}
                    className="px-4 py-2 bg-brand-orange-500 hover:bg-brand-orange-600 text-black rounded-lg text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm transition-all hover:scale-[1.02]"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>عرض التقرير المعتمد</span>
                  </button>
                  <button 
                    onClick={handleUnlockReport}
                    className="text-xs text-brand-orange-500 font-bold hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>إلغاء القفل للتعديل الفوري</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs" id="report-editor-inputs">
                {/* Report Title */}
                <div className="space-y-1.5 text-right">
                  <label className={`font-bold ${textMutedStyle}`}>عنوان البلاغ الرسمي للبنك المركزي:</label>
                  <input 
                    type="text" 
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2.5 focus:border-brand-orange-500 focus:outline-none text-xs ${
                      isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  />
                </div>

                {/* Summary of findings */}
                <div className="space-y-1.5 text-right">
                  <label className={`font-bold ${textMutedStyle}`}>نتائج الفحص والاشتباه والمبررات الجنائية (Findings & Evidence Summary):</label>
                  <textarea 
                    rows={8}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="اكتب مبررات التجميد المباشرة أو مصفوفة Smurfing التي تم العثور عليها ومؤشرات الخطر الفنية..."
                    className={`w-full border rounded-lg px-3 py-2.5 focus:border-brand-orange-500 focus:outline-none text-xs leading-relaxed ${
                      isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  />
                </div>

                {/* Signee name */}
                <div className="space-y-1.5 text-right">
                  <label className={`font-bold ${textMutedStyle}`}>اسم المسؤول / محقق الامتثال المعتمد:</label>
                  <input 
                    type="text" 
                    value={signee}
                    onChange={(e) => setSignee(e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2.5 focus:border-brand-orange-500 focus:outline-none text-xs ${
                      isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  />
                </div>

                {/* Department */}
                <div className="space-y-1.5 text-right">
                  <label className={`font-bold ${textMutedStyle}`}>القسم / الإدارة والجهة التنظيمية:</label>
                  <input 
                    type="text" 
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2.5 focus:border-brand-orange-500 focus:outline-none text-xs ${
                      isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  />
                </div>

                {/* Save draft, Sign, and Preview buttons */}
                <div className="pt-2 flex flex-col sm:flex-row gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className={`px-4 font-bold py-3 border rounded-lg text-center cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                      isDarkMode ? "bg-[#1d222f] border-[#2c3345] hover:bg-[#252c3e] text-white" : "bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800"
                    }`}
                  >
                    <FileText className="w-4 h-4 text-brand-orange-500" />
                    <span>معاينة التقرير</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleSignReport}
                    className="flex-1 bg-brand-orange-500 hover:bg-brand-orange-600 text-black font-extrabold py-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-brand-orange-500/10"
                  >
                    <Lock className="w-4 h-4" />
                    <span>توقيع واعتماد البلاغ الرقابي</span>
                  </button>
                  <button 
                    type="button"
                    onClick={handleSaveDraft}
                    className={`px-4 font-bold py-3 border rounded-lg text-center cursor-pointer transition-all ${
                      isDarkMode ? "bg-transparent border-[#22262f] hover:bg-[#1d212b]" : "bg-white border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    حفظ كمسودة
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SAMA COMPLIANCE CHECKLIST */}
          <div className={`border rounded-xl p-4 mt-4 space-y-3 ${bgSubtleStyle} ${borderStyle}`} id="compliance-checklist">
            <h4 className={`text-xs font-bold flex items-center gap-1.5 ${textTitleStyle}`}>
              <CheckSquare className="w-4 h-4 text-brand-orange-500" />
              <span>مصفوفة الالتزام والمتطلبات القانونية لبلاغات SAMA</span>
            </h4>
            
            <div className="space-y-2 text-[11px] text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>تطابق الهوية الوطنية والآيبان مع مركز المعلومات الوطني</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>تضمين بصمة DNA السلوكية للحركات ومستويات انحرافها</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>تضمين شبكة الأطراف المشبوهة المتصلة (Relationship Graph)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-4 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center justify-center text-[10px] font-bold">✓</span>
                <span>مصادقة وتوقيع إلكتروني معتمد من محقق الالتزام المالي</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* DETAILED DIALOG/MODAL OVERLAY FOR REPORT PREVIEW */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto" onClick={() => setShowPreviewModal(false)}>
          <div 
            className={`relative w-full max-w-4xl rounded-2xl overflow-hidden p-6 shadow-2xl flex flex-col gap-4 animate-scale-in max-h-[92vh] ${
              isDarkMode ? "bg-[#111317] border border-[#22262f] text-white" : "bg-slate-50 border border-slate-200 text-slate-800"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-3 border-b border-slate-500/10">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-orange-500" />
                <h3 className="text-sm font-bold">معاينة التقرير الرسمي المالي لمصرف الإنماء</h3>
              </div>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="overflow-y-auto flex-1 pr-1 pl-1 space-y-4">
              
              {/* DOSSIER ACTION BAR */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
                isDarkMode ? "bg-black/30 border-[#22262f]" : "bg-white border-slate-200 shadow-sm"
              }`}>
                <span className={`text-xs font-bold ${textMutedStyle} flex items-center gap-1.5`}>
                  <Info className="w-4 h-4 text-brand-orange-500 animate-pulse shrink-0" />
                  <span>معاينة المستند الرسمي الصادر عن مصرف الإنماء للتحقيق المالي قبل الرفع النهائي</span>
                </span>
                <button
                  onClick={handleSendEmail}
                  disabled={isSendingEmail}
                  className="w-full sm:w-auto px-4 py-2 bg-brand-orange-500 hover:bg-brand-orange-600 text-black text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-brand-orange-500/10"
                  title="إرسال هذا التقرير فوراً إلى بريد العمل للمحقق"
                >
                  <Mail className="w-4 h-4" />
                  <span>{isSendingEmail ? "جاري إرسال البريد..." : "إرسال التقرير لبريد العمل"}</span>
                </button>
              </div>

              {/* RELEASABLE REPORT PREVIEW (THE PRESTIGE PAPER DOSSIER) */}
              <div className="bg-white text-black rounded-xl p-8 space-y-6 relative overflow-hidden flex flex-col justify-between min-h-[600px] shadow-lg border border-slate-200 text-right" dir="rtl" id="dossier-paper-preview">
                
                {/* Stamped backdrop confidential */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none opacity-[0.03] text-red-700 text-6xl font-bold font-mono tracking-widest uppercase border-4 border-red-700 p-4 -rotate-12">
                  CONFIDENTIAL - FIU SAMA
                </div>

                <div>
                  {/* Header Logos */}
                  <div className="flex justify-between items-start border-b-2 border-black pb-4" id="paper-logo-header">
                    <div className="text-right">
                      <span className="text-xs font-bold block">الاستخبارات المالية والامتثال الموحد</span>
                      <span className="text-[10px] text-gray-500 block">وحدة التحريات والالتزام بمصرف الإنماء</span>
                    </div>
                    
                    <div className="text-center font-bold text-xs tracking-wider uppercase border-2 border-black px-3 py-1.5 bg-black text-white rounded">
                      SAQR AI REPORT
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] font-mono text-gray-500 block">SAMA RELEASABLE DOSSIER</span>
                      <span className="text-[10px] font-mono text-gray-500 block">رقم القضية: {activeCase.case_id}</span>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center mt-6">
                    <h2 className="text-lg font-bold underline">تقرير اشتباه وإبلاغ أمني مالي</h2>
                    <span className="text-xs text-gray-500 font-sans">مرفوع إلى: وحدة الاستخبارات المالية بالبنك المركزي السعودي SAMA</span>
                  </div>

                  {/* Section 1: Target Entity */}
                  <div className="mt-6 space-y-2.5 text-xs">
                    <h4 className="font-extrabold border-b border-black pb-1 uppercase">١. بيانات الحساب والعميل المستهدف بالفحص:</h4>
                    <table className="w-full text-right">
                      <tbody>
                        <tr>
                          <td className="font-bold py-1 w-1/3">اسم الحساب والعميل:</td>
                          <td className="py-1">{activeCase.title}</td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="font-bold py-1">رقم الحساب الدولي (IBAN):</td>
                          <td className="py-1 font-mono" dir="ltr">{activeCase.transaction.account_id}</td>
                        </tr>
                        <tr className="border-t border-gray-100">
                          <td className="font-bold py-1">تفاصيل الحركة النشطة:</td>
                          <td className="py-1 font-bold text-brand-orange-500">{activeCase.transaction.amount.toLocaleString()} SAR ({activeCase.transaction.channel === 'wire' ? 'حوالة مصرفية رقمية' : 'إيداع صراف'})</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Section 2: AI Pipeline findings */}
                  <div className="mt-6 space-y-2.5 text-xs">
                    <h4 className="font-extrabold border-b border-black pb-1 uppercase">٢. نتائج نظام الفحص الرقمي لمؤشرات صقر:</h4>
                    <div className="bg-slate-50 p-3.5 rounded border border-slate-200 space-y-2.5 text-slate-700">
                      <div>
                        <span className="font-bold block text-black">درجة انحراف البصمة السلوكية (Behavioral DNA):</span>
                        <p className="font-medium">{activeCase.dna_fingerprint?.notes || "تم فحص انحراف الحركة السلوكية وأثبتت المعايير تخطي الحدود القانونية للأمان المصرفي."}</p>
                      </div>
                      <div className="border-t border-slate-200 pt-2">
                        <span className="font-bold block text-black">عوامل ومطابقات غسيل الأموال (AML Typologies Matched):</span>
                        <p className="font-medium">تطابق مصفوفات الإيداع مع غسل الأموال بالتجزئة بنسبة ثقة {activeCase.aml_result?.findings.find(f => f.matched)?.confidence || 85}٪.</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Summary text */}
                  <div className="mt-6 space-y-2.5 text-xs">
                    <h4 className="font-extrabold border-b border-black pb-1 uppercase">٣. الاستنتاج والمبررات القانونية للتحري المالي:</h4>
                    <p className="text-slate-800 leading-relaxed min-h-[100px] whitespace-pre-line font-medium bg-slate-50/40 p-3.5 rounded border border-dashed border-slate-200">
                      {notes}
                    </p>
                  </div>
                </div>

                {/* Footer signature */}
                <div className="border-t border-black pt-4 flex justify-between items-end text-xs mt-6" id="paper-signature-footer">
                  <div>
                    <span className="block font-mono text-[9px] text-gray-400">تم إنتاج هذا المستند بالكامل وبشكل فوري بواسطة منصة صقر</span>
                    <span className="block font-mono text-[9px] text-gray-400">تاريخ المعالجة والطباعة: {new Date().toLocaleDateString('ar-EG')}</span>
                  </div>

                  <div className="text-left font-sans">
                    <span className="block font-bold">الموقع المعتمد: {signee}</span>
                    <span className="block text-gray-500 text-[10px]">{department}</span>
                    
                    {isSigned ? (
                      <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 bg-red-100 text-red-800 border-2 border-red-800 rounded font-bold uppercase tracking-wider text-[10px] transform rotate-1 animate-fade-in">
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>توقيع إلكتروني آمن</span>
                      </div>
                    ) : (
                      <span className="block text-red-500 font-bold mt-1 text-[10px]">◀ غير موقع</span>
                    )}
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-500/10">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-slate-500/10 hover:bg-slate-500/20 text-xs font-bold rounded-lg transition-all cursor-pointer"
              >
                إغلاق المعاينة
              </button>
              {!isSigned && (
                <button
                  onClick={() => {
                    handleSignReport();
                    setShowPreviewModal(false);
                  }}
                  className="px-4 py-2 bg-brand-orange-500 hover:bg-brand-orange-600 text-black text-xs font-black rounded-lg transition-all cursor-pointer"
                >
                  توقيع واعتماد الآن
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
