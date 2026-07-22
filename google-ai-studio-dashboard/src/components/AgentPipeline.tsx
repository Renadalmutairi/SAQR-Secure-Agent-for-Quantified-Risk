import React, { useState, useEffect } from "react";
import { 
  Cpu, 
  RotateCcw, 
  Terminal, 
  CheckCircle, 
  Fingerprint, 
  Activity, 
  Share2, 
  ShieldAlert, 
  FileText,
  Award,
  ChevronLeft,
  ChevronRight,
  FastForward,
  Play
} from "lucide-react";
import { InvestigationState, RiskLevel } from "../types";

interface AgentPipelineProps {
  activeCase: InvestigationState;
  allCases: InvestigationState[];
  onUpdateCase: (updatedCase: InvestigationState) => void;
  onSelectCaseById: (caseId: string) => void;
  onNavigate: (page: string) => void;
  isDarkMode?: boolean;
}

export default function AgentPipeline({ 
  activeCase, 
  allCases, 
  onUpdateCase, 
  onSelectCaseById, 
  onNavigate,
  isDarkMode = false 
}: AgentPipelineProps) {
  const [currentStep, setCurrentStep] = useState<number>(activeCase.pipeline_step || 0);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<number>(1);

  const simulationSteps = [
    {
      step: 1,
      name: "DNA Agent",
      log: `[DNA Agent] جاري تشغيل محرك البصمة السلوكية ومقارنة الحساب بالبصمة التاريخية...`,
      completionLog: `[DNA Agent] تم الفحص بنجاح. نسبة الانحراف السلوكي للحساب: ${Math.round((activeCase.dna_fingerprint?.deviation_score || 0) * 100)}%`
    },
    {
      step: 2,
      name: "Supervisor Agent",
      log: `[Supervisor Agent] جاري تحليل نسبة الانحراف السلوكي وترتيب أولويات التحقيق...`,
      completionLog: `[Supervisor Agent] تم التوجيه: الحساب يتطلب مراجعة كاملة (Full Pipeline). المسار المعتمد: ${activeCase.route_decision === 'fast_track' ? 'تخطي تلقائي ومؤرشف' : 'متابعة الفحص القياسي'}`
    },
    {
      step: 3,
      name: "Graph Agent",
      log: `[Graph Agent] جاري استخراج العلاقات وتحليل المتصلين بالأجهزة والعناوين الرقمية...`,
      completionLog: `[Graph Agent] تم اكتمال رسم مخطط العلاقات المالي. تم رصد عدد ${activeCase.graph_result?.suspicious_node_ids.length || 0} عقد مشبوهة بمجموع روابط متبادلة.`
    },
    {
      step: 4,
      name: "AML Agent",
      log: `[AML Agent] جاري تطبيق خوارزميات كشف غسيل الأموال ومطابقة أنماط SAMA...`,
      completionLog: `[AML Agent] تم الرصد! مطابقة نمط غسيل الأموال بالتجزئة وثقة عالية.`
    },
    {
      step: 5,
      name: "Trust Agent",
      log: `[Trust Agent] جاري تركيب مخرجات الفحص وحساب الخطورة النهائية واتخاذ القرار...`,
      completionLog: `[Trust Agent] تم القرار: خطورة القضية ${activeCase.trust_decision?.risk_score}٪ بمستوى ${activeCase.trust_decision?.risk_level.toUpperCase()}. الإجراء الموصى به: ${activeCase.trust_decision?.recommended_action.toUpperCase()}`
    }
  ];

  // Initialize logs on change or reset
  useEffect(() => {
    const step = activeCase.pipeline_step || 0;
    setCurrentStep(step);
    
    // Generate historic logs based on current step
    const initialLogs = [
      `[نظام صقر] تم شحن القضية رقم ${activeCase.case_id} بنجاح.`,
      `[نظام صقر] في انتظار بدء محرك الفحص الذكي للتحقق من الحركات البنكية...`
    ];

    for (let i = 0; i < step; i++) {
      if (simulationSteps[i]) {
        initialLogs.push(simulationSteps[i].log);
        initialLogs.push(simulationSteps[i].completionLog);
      }
    }

    if (step === 6) {
      initialLogs.push(`[نظام صقر] تم إنجاز الفحص بنجاح وإنتاج تقرير التحقيق النهائي والقابل للمشاركة.`);
    }

    setLogs(initialLogs);
    if (step > 0 && step <= 5) {
      setSelectedAgentDetail(step);
    } else {
      setSelectedAgentDetail(1);
    }
  }, [activeCase.case_id]);

  // Save pipeline step to central state
  const savePipelineStep = (stepNum: number) => {
    const updated = { ...activeCase, pipeline_step: stepNum };
    onUpdateCase(updated);
  };

  // Next Step Action
  const handleNextStep = () => {
    if (currentStep >= 6) return;

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);

    if (nextStep <= 5) {
      const activeSim = simulationSteps[nextStep - 1];
      setLogs(prev => [
        ...prev,
        activeSim.log,
        activeSim.completionLog
      ]);
      setSelectedAgentDetail(nextStep);
    } else if (nextStep === 6) {
      setLogs(prev => [
        ...prev,
        `[نظام صقر] تم إنجاز الفحص بنجاح وإنتاج تقرير التحقيق النهائي والقابل للمشاركة.`
      ]);
    }

    savePipelineStep(nextStep);
  };

  // Previous Step Action
  const handlePrevStep = () => {
    if (currentStep <= 0) return;

    const prevStep = currentStep - 1;
    setCurrentStep(prevStep);
    setLogs(prev => [
      ...prev,
      `[تراجع] تم الرجوع للخطوة السابقة (${prevStep === 0 ? "الحركة المستلمة" : "الوكيل المالي " + prevStep}) لإعادة التدقيق.`
    ]);

    if (prevStep > 0 && prevStep <= 5) {
      setSelectedAgentDetail(prevStep);
    }

    savePipelineStep(prevStep);
  };

  // Fast-Forward to End Action
  const handleFastForward = () => {
    setCurrentStep(6);
    const completedLogs = [
      `[نظام صقر] تم شحن القضية رقم ${activeCase.case_id} بنجاح.`,
      `[نظام صقر] في انتظار بدء محرك الفحص الذكي للتحقق من الحركات البنكية...`
    ];

    simulationSteps.forEach(step => {
      completedLogs.push(step.log);
      completedLogs.push(step.completionLog);
    });

    completedLogs.push(`[نظام صقر] تم إنجاز الفحص بنجاح وإنتاج تقرير التحقيق النهائي والقابل للمشاركة.`);
    setLogs(completedLogs);
    setSelectedAgentDetail(5);
    savePipelineStep(6);
  };

  // Reset Action
  const resetPipeline = () => {
    setCurrentStep(0);
    setSelectedAgentDetail(1);
    setLogs([
      `[نظام صقر] تم إعادة ضبط القضية رقم ${activeCase.case_id}.`,
      `[نظام صقر] في انتظار بدء محرك الفحص الذكي...`
    ]);
    savePipelineStep(0);
  };

  // Theme variable styles
  const cardStyle = isDarkMode 
    ? "bg-[#111317] border-[#22262f] text-gray-200" 
    : "bg-white border-slate-200/80 text-slate-800 shadow-sm";
  const borderStyle = isDarkMode ? "border-[#22262f]" : "border-slate-200";
  const bgStyle = isDarkMode ? "bg-[#090a0c]" : "bg-slate-50";
  const bgSubtleStyle = isDarkMode ? "bg-[#090a0c]/40" : "bg-slate-50 border-slate-100";
  const textTitleStyle = isDarkMode ? "text-white" : "text-slate-900";
  const textMutedStyle = isDarkMode ? "text-gray-400" : "text-slate-500";

  return (
    <div className="space-y-6 font-sans animate-fade-in" id="pipeline-view">
      
      {/* HEADER SECTION */}
      <div className={`flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-4 ${borderStyle}`} id="pipeline-header">
        <div>
          <h1 className={`text-2xl font-black flex items-center gap-2 ${textTitleStyle}`}>
            <Cpu className="w-6 h-6 text-brand-orange-500" />
            <span>محاكي معالجة خطوط الإنتاج المتعددة الوكلاء (AI Agents Pipeline)</span>
          </h1>
          <p className={`text-xs mt-1 ${textMutedStyle}`}>
            تحكّم بشكل كامل وسلس في انتقال القضية المشتبه بها عبر وكلاء صقر الذكيين بالتسلسل لاتخاذ القرار المالي
          </p>
        </div>

        {/* Action controllers */}
        <div className="flex flex-wrap gap-2 shrink-0">
          {/* Previous Step */}
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 0}
            className={`px-3.5 py-2.5 border text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              currentStep === 0 
                ? "opacity-40 cursor-not-allowed text-slate-400" 
                : isDarkMode ? "bg-[#111317] hover:bg-[#171a21] border-[#22262f] text-gray-200" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
            }`}
            title="العودة للخطوة السابقة للتحري المالي"
          >
            <ChevronRight className="w-4 h-4 text-brand-orange-500" />
            <span>الخطوة السابقة</span>
          </button>

          {/* Next Step */}
          <button
            onClick={handleNextStep}
            disabled={currentStep === 6}
            className={`px-3.5 py-2.5 border text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              currentStep === 6 
                ? "opacity-40 cursor-not-allowed text-slate-400" 
                : "bg-brand-orange-500 hover:bg-brand-orange-600 text-black border-brand-orange-500"
            }`}
            title="تمرير القضية للوكيل المالي التالي"
          >
            <span>الخطوة التالية</span>
            <ChevronLeft className="w-4 h-4 text-black" />
          </button>

          {/* Fast Forward */}
          <button
            onClick={handleFastForward}
            disabled={currentStep === 6}
            className={`px-3.5 py-2.5 border text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              currentStep === 6 
                ? "opacity-40 cursor-not-allowed text-slate-400" 
                : isDarkMode ? "bg-[#111317] hover:bg-[#171a21] border-[#22262f] text-yellow-500" : "bg-white hover:bg-yellow-500/10 border-slate-200 text-slate-700 hover:text-yellow-600"
            }`}
            title="تجاوز جميع الفحوصات وإنتاج التقرير مباشرة"
          >
            <FastForward className="w-4 h-4" />
            <span>تجاوز سريع للنهاية</span>
          </button>
          
          <button
            onClick={resetPipeline}
            className={`px-3.5 py-2.5 border text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
              isDarkMode ? "bg-[#111317] hover:bg-[#171a21] border-[#22262f] text-gray-400" : "bg-white hover:bg-slate-50 border-slate-200 text-slate-500"
            }`}
            title="إعادة شحن المعاملة وضبط الفحص"
          >
            <RotateCcw className="w-4 h-4 text-slate-400" />
            <span>إعادة ضبط</span>
          </button>
        </div>
      </div>

      {/* AGENT ROADMAP PIPELINE WORKFLOW CARD */}
      <div className={`border rounded-xl p-6 ${cardStyle}`} id="pipeline-roadmap-panel">
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-xs font-mono font-bold uppercase tracking-wider ${textMutedStyle}`}>سلسلة معالجة القضية النشطة (انقر على النقاط أو التقرير للانتقال)</h3>
          <span className="text-xs font-mono text-brand-orange-500 font-bold">{activeCase.case_id}</span>
        </div>

        {/* Connected Dots Workflow */}
        <div className="relative flex flex-col md:flex-row justify-between items-center gap-8 md:gap-4 pb-4" id="workflow-dots">
          
          {/* Horizontal connecting wire behind */}
          <div className={`absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 hidden md:block -z-0 ${
            isDarkMode ? "bg-[#22262f]" : "bg-slate-200"
          }`}></div>
          
          {/* Active progress indicator wire */}
          <div 
            className="absolute top-1/2 left-0 h-0.5 bg-brand-orange-500 -translate-y-1/2 hidden md:block transition-all duration-500 -z-0"
            style={{ width: `${Math.min((currentStep / 6) * 100, 100)}%` }}
          ></div>

          {/* Step 0: Input Transaction */}
          <div 
            className="flex flex-col items-center text-center relative z-10 cursor-pointer" 
            id="step-0-dot"
            onClick={() => {
              setCurrentStep(0);
              savePipelineStep(0);
            }}
          >
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-all duration-300 ${
              currentStep >= 0 
                ? "bg-brand-orange-500 border-brand-orange-500 text-black shadow-md" 
                : isDarkMode ? "bg-[#111317] border-[#22262f] text-gray-500" : "bg-white border-slate-200 text-slate-400"
            }`}>
              IN
            </div>
            <span className={`text-xs font-bold mt-2 ${textTitleStyle}`}>الحركة المستلمة</span>
            <span className="text-[10px] text-slate-400 font-mono mt-0.5">{activeCase.transaction.amount.toLocaleString()} SAR</span>
          </div>

          <div className="text-slate-400 font-mono text-xs md:block hidden select-none">➔</div>

          {/* Step 1: DNA Agent */}
          <div 
            className="flex flex-col items-center text-center relative z-10 cursor-pointer" 
            onClick={() => {
              setCurrentStep(1);
              setSelectedAgentDetail(1);
              savePipelineStep(1);
            }}
          >
            <div className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all duration-300 ${
              currentStep === 1 ? "bg-brand-orange-500/10 border-brand-orange-500 text-brand-orange-500 scale-110 shadow-lg shadow-brand-orange-500/10" :
              currentStep > 1 ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" :
              isDarkMode ? "bg-[#090a0c] border-[#22262f] text-gray-500" : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <Fingerprint className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold mt-2 ${textTitleStyle}`}>1. DNA Agent</span>
            <span className="text-[10px] text-slate-400 mt-0.5">البصمة السلوكية</span>
          </div>

          <div className="text-slate-400 font-mono text-xs md:block hidden select-none">➔</div>

          {/* Step 2: Supervisor Agent */}
          <div 
            className="flex flex-col items-center text-center relative z-10 cursor-pointer"
            onClick={() => {
              setCurrentStep(2);
              setSelectedAgentDetail(2);
              savePipelineStep(2);
            }}
          >
            <div className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all duration-300 ${
              currentStep === 2 ? "bg-brand-orange-500/10 border-brand-orange-500 text-brand-orange-500 scale-110 shadow-lg shadow-brand-orange-500/10" :
              currentStep > 2 ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" :
              isDarkMode ? "bg-[#090a0c] border-[#22262f] text-gray-500" : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold mt-2 ${textTitleStyle}`}>2. Supervisor</span>
            <span className="text-[10px] text-slate-400 mt-0.5">توجيه العمليات</span>
          </div>

          <div className="text-slate-400 font-mono text-xs md:block hidden select-none">➔</div>

          {/* Step 3: Graph Agent */}
          <div 
            className="flex flex-col items-center text-center relative z-10 cursor-pointer"
            onClick={() => {
              setCurrentStep(3);
              setSelectedAgentDetail(3);
              savePipelineStep(3);
            }}
          >
            <div className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all duration-300 ${
              currentStep === 3 ? "bg-brand-orange-500/10 border-brand-orange-500 text-brand-orange-500 scale-110 shadow-lg shadow-brand-orange-500/10" :
              currentStep > 3 ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" :
              isDarkMode ? "bg-[#090a0c] border-[#22262f] text-gray-500" : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <Share2 className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold mt-2 ${textTitleStyle}`}>3. Graph Agent</span>
            <span className="text-[10px] text-slate-400 mt-0.5">مخطط العلاقات</span>
          </div>

          <div className="text-slate-400 font-mono text-xs md:block hidden select-none">➔</div>

          {/* Step 4: AML Agent */}
          <div 
            className="flex flex-col items-center text-center relative z-10 cursor-pointer"
            onClick={() => {
              setCurrentStep(4);
              setSelectedAgentDetail(4);
              savePipelineStep(4);
            }}
          >
            <div className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all duration-300 ${
              currentStep === 4 ? "bg-brand-orange-500/10 border-brand-orange-500 text-brand-orange-500 scale-110 shadow-lg shadow-brand-orange-500/10" :
              currentStep > 4 ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" :
              isDarkMode ? "bg-[#090a0c] border-[#22262f] text-gray-500" : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold mt-2 ${textTitleStyle}`}>4. AML Agent</span>
            <span className="text-[10px] text-slate-400 mt-0.5">مكافحة غسل الأموال</span>
          </div>

          <div className="text-slate-400 font-mono text-xs md:block hidden select-none">➔</div>

          {/* Step 5: Trust Agent */}
          <div 
            className="flex flex-col items-center text-center relative z-10 cursor-pointer"
            onClick={() => {
              setCurrentStep(5);
              setSelectedAgentDetail(5);
              savePipelineStep(5);
            }}
          >
            <div className={`w-12 h-12 rounded-full border flex flex-col items-center justify-center transition-all duration-300 ${
              currentStep === 5 ? "bg-brand-orange-500/10 border-brand-orange-500 text-brand-orange-500 scale-110 shadow-lg shadow-brand-orange-500/10" :
              currentStep > 5 ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" :
              isDarkMode ? "bg-[#090a0c] border-[#22262f] text-gray-500" : "bg-slate-50 border-slate-200 text-slate-400"
            }`}>
              <Award className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold mt-2 ${textTitleStyle}`}>5. Trust Agent</span>
            <span className="text-[10px] text-slate-400 mt-0.5">القرار والتقييم</span>
          </div>

          <div className="text-slate-400 font-mono text-xs md:block hidden select-none">➔</div>

          {/* Step 6: Completed Report (FULLY CLICKABLE) */}
          <div 
            className="flex flex-col items-center text-center relative z-10 cursor-pointer" 
            id="step-completed-dot"
            onClick={() => {
              if (currentStep === 6) {
                onNavigate("reports");
              } else {
                setCurrentStep(6);
                savePipelineStep(6);
              }
            }}
            title={currentStep === 6 ? "انقر فوراً للانتقال إلى مسودة التقرير النهائي" : "اعتماد فوري للفحص النهائي"}
          >
            <div className={`w-10 h-10 rounded-full border flex items-center justify-center font-mono text-xs font-bold transition-all duration-300 ${
              currentStep === 6 
                ? "bg-emerald-500 border-emerald-600 text-black scale-110 shadow-lg shadow-emerald-500/20 animate-bounce" 
                : isDarkMode ? "bg-[#111317] border-[#22262f] text-gray-500" : "bg-white border-slate-200 text-slate-400"
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold mt-2 ${currentStep === 6 ? "text-emerald-500 font-black" : textTitleStyle}`}>التقرير النهائي</span>
            <span className="text-[9px] text-emerald-500 font-mono mt-0.5">{currentStep === 6 ? "انقر للفتح 📝" : "قيد المعالجة"}</span>
          </div>

        </div>
      </div>

      {/* DYNAMIC GUIDING PROMPT AT FINISH */}
      {currentStep === 6 && (
        <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fade-in">
          <div>
            <h4 className="text-sm font-bold text-emerald-600 flex items-center gap-1.5">
              <CheckCircle className="w-5 h-5" />
              <span>اكتمل الفحص الفني الذكي للقضية!</span>
            </h4>
            <p className="text-xs text-slate-500 mt-1">تمت مطابقة العلاقات الجغرافية والأنماط المعقدة وحساب درجة الخطر. التقرير النهائي جاهز تماماً للتدقيق البشري والرفع الرقابي.</p>
          </div>
          <button
            onClick={() => onNavigate("reports")}
            className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-black rounded-lg transition-all shadow-md shadow-emerald-500/15 cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <span>الانتقال لتحرير التقرير المالي 📝</span>
          </button>
        </div>
      )}

      {/* LAYOUT: TERMINAL CONSOLE + ACTIVE AGENT DETAIL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="pipeline-execution-grid">
        
        {/* TERMINAL CONSOLE LOGS */}
        <div className={`border rounded-xl p-5 flex flex-col justify-between ${
          isDarkMode ? "bg-[#0b0c10] border-[#22262f]" : "bg-slate-900 border-slate-800"
        }`} id="terminal-console-panel">
          <div>
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2 font-mono text-xs text-brand-orange-500">
                <Terminal className="w-4 h-4" />
                <span>سجل المخرجات ومحاكي الأوامر (SAQR Console Log)</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            <div className="space-y-2 h-[260px] overflow-y-auto font-mono text-[11px] leading-relaxed text-gray-300 select-all pr-1" id="terminal-logs-body" style={{ scrollbarWidth: 'thin' }}>
              {logs.map((log, index) => (
                <div key={index} className="border-l border-brand-orange-500/20 pl-2.5">
                  <span className="text-slate-500 shrink-0 select-none">[{new Date().toLocaleTimeString('ar-EG', { hour12: false })}] </span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/5 pt-3 text-[10px] text-slate-500 font-mono flex justify-between">
            <span>المنفذ الرئيسي: SAQR COGNITIVE BACKPLANE</span>
            <span>بث مباشر (Manual Overrides Enabled)</span>
          </div>
        </div>

        {/* ACTIVE AGENT FINDINGS CARD */}
        <div className={`border rounded-xl p-5 ${cardStyle}`} id="agent-detail-card">
          
          {/* Agent Selector Tabs */}
          <div className={`flex border-b pb-3 mb-4 gap-2 text-xs font-mono overflow-x-auto ${borderStyle}`} style={{ scrollbarWidth: 'none' }}>
            {[
              { id: 1, name: "DNA Agent" },
              { id: 2, name: "Supervisor" },
              { id: 3, name: "Graph Agent" },
              { id: 4, name: "AML Agent" },
              { id: 5, name: "Trust Agent" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedAgentDetail(tab.id)}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  selectedAgentDetail === tab.id 
                    ? "bg-brand-orange-500/10 text-brand-orange-500 border border-brand-orange-500/30 font-bold" 
                    : "text-slate-400 hover:text-slate-800"
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* Details based on selected agent */}
          {selectedAgentDetail === 1 && (
            <div className="space-y-4 animate-fade-in" id="dna-detail-content">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-base font-black ${textTitleStyle}`}>Behavioral DNA Agent</h3>
                  <p className="text-xs text-slate-400">محرك فحص البصمة السلوكية ومقارنة الحساب بالبصمة التاريخية</p>
                </div>
                <div className="text-left font-mono shrink-0">
                  <span className="text-[10px] text-slate-400 block font-bold">انحراف البصمة</span>
                  <span className="text-xl font-black text-brand-orange-500">{Math.round((activeCase.dna_fingerprint?.deviation_score || 0) * 100)}%</span>
                </div>
              </div>

              <div className={`border rounded-lg p-3 text-xs space-y-2 ${bgSubtleStyle} ${borderStyle}`}>
                <h4 className={`font-bold ${textTitleStyle}`}>أبرز خصائص السلوك والانحراف:</h4>
                <p className="leading-relaxed text-slate-500 font-medium">
                  {activeCase.dna_fingerprint?.notes || "لم يتم تشغيل المحرك بعد لتمرير البصمة السلوكية."}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className={`border p-3 rounded-lg ${bgSubtleStyle} ${borderStyle}`}>
                  <span className="text-slate-400 block text-[10px] font-bold">معرف الهوية السلوكي:</span>
                  <span className={`text-[11px] font-bold block mt-1 truncate ${textTitleStyle}`}>{activeCase.dna_fingerprint?.fingerprint_hash || "SAQR-DNA-HASH"}</span>
                </div>
                <div className={`border p-3 rounded-lg ${bgSubtleStyle} ${borderStyle}`}>
                  <span className="text-slate-400 block text-[10px] font-bold">توقيت المطابقة والتحقق:</span>
                  <span className={`text-[11px] font-bold block mt-1 ${textTitleStyle}`}>تلقائي فوري بموجب اللوائح</span>
                </div>
              </div>
            </div>
          )}

          {selectedAgentDetail === 2 && (
            <div className="space-y-4 animate-fade-in" id="supervisor-detail-content">
              <div>
                <h3 className={`text-base font-black ${textTitleStyle}`}>Investigation Supervisor</h3>
                <p className="text-xs text-slate-400">إدارة مسار الفحص الذكي وترتيب أولويات المخاطر</p>
              </div>

              <div className={`border rounded-lg p-3.5 text-xs space-y-3 ${bgSubtleStyle} ${borderStyle}`}>
                <div className="flex justify-between items-center border-b pb-2 border-current/10">
                  <span className="text-slate-400">توجيه سير المعاملة:</span>
                  <span className="font-mono text-brand-orange-500 font-bold">
                    {activeCase.route_decision === 'fast_track' ? "تخطي سريع وأرشفة (Fast-Track)" : "فحص تفصيلي كامل (Full Pipeline)"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">أولوية التحقيق الممنوحة:</span>
                  <span className="px-2.5 py-0.5 rounded text-[10px] border border-brand-orange-500/25 bg-brand-orange-500/5 text-brand-orange-500 font-bold">
                    {activeCase.trust_decision?.risk_level.toUpperCase() || "HIGH"}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                يقوم وكيل الـ Supervisor بقراءة مؤشر انحراف البصمة المالية المبدئي؛ فإذا كان الانحراف أقل من ٥٪ يتم تخطي الفحص وأرشفة القضية تلقائياً لحماية الموارد. وإلا يتم توجيه القضية لمطابقة العلاقات والأنماط المعقدة.
              </p>
            </div>
          )}

          {selectedAgentDetail === 3 && (
            <div className="space-y-4 animate-fade-in" id="graph-detail-content">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-base font-black ${textTitleStyle}`}>Relationship Graph Agent</h3>
                  <p className="text-xs text-slate-400">تحليل قنوات التحويل ورصد شركاء السلوك المشتبه بهم</p>
                </div>
                <div className="text-left font-mono shrink-0">
                  <span className="text-[10px] text-slate-400 block font-bold">العقد المشبوهة المتصلة</span>
                  <span className="text-xl font-black text-brand-orange-500">{activeCase.graph_result?.suspicious_node_ids.length || 0}</span>
                </div>
              </div>

              <div className={`border rounded-lg p-3 text-xs space-y-2 ${bgSubtleStyle} ${borderStyle}`}>
                <h4 className={`font-bold ${textTitleStyle}`}>أبرز روابط الشبكة المكتشفة:</h4>
                <p className="leading-relaxed text-slate-500 font-medium">
                  {activeCase.graph_result?.notes || "لم يتم فحص مخطط العلاقات لهذه القضية."}
                </p>
              </div>

              <div className="text-xs text-slate-500 leading-relaxed font-medium">
                يقوم وكيل الـ Graph بفحص السجلات ومطابقة معرفات الأجهزة المشتركة (IMEI)، عناوين الـ IP الدولية للتحقق من عدم وجود تداخل جغرافي مستحيل، ومستفيدي الحوالات المتواطئين.
              </div>
            </div>
          )}

          {selectedAgentDetail === 4 && (
            <div className="space-y-4 animate-fade-in" id="aml-detail-content">
              <div>
                <h3 className={`text-base font-black ${textTitleStyle}`}>AML Pattern Engine</h3>
                <p className="text-xs text-slate-400">مطابقة أنماط وتصنيفات مكافحة غسيل الأموال بموجب لوائح البنك المركزي السعودي SAMA</p>
              </div>

              <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {activeCase.aml_result?.findings.map((find, i) => (
                  <div key={i} className={`border rounded-lg p-3 text-xs ${bgSubtleStyle} ${borderStyle}`}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`font-bold ${textTitleStyle}`}>{find.typology === 'smurfing' ? 'تجزئة الأموال بالتعاون (Smurfing)' : find.typology === 'structuring' ? 'تقسيم هيكلي للودائع (Structuring)' : 'السرقة والاحتيال المالي'}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono border ${
                        find.matched ? "bg-red-500/10 border-red-500/25 text-red-500 font-bold" : "text-slate-400 border-slate-200"
                      }`}>
                        {find.matched ? `نشط - ${find.confidence}% ثقة` : "غير مطابق"}
                      </span>
                    </div>
                    {find.matched && (
                      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-medium">
                        {find.evidence["الوصف"] || find.evidence["وصف الهيكلة"] || "مطابقة تامة لسيناريوهات محاولة تجنب متطلبات الإفصاح المالي."}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedAgentDetail === 5 && (
            <div className="space-y-4 animate-fade-in" id="trust-detail-content">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`text-base font-black ${textTitleStyle}`}>Trust & Risk Engine</h3>
                  <p className="text-xs text-slate-400">محرك اتخاذ القرار النهائي والتقييم للامتثال والتحقيق</p>
                </div>
                <div className="text-left font-mono shrink-0">
                  <span className="text-[10px] text-slate-400 block font-bold">مؤشر الخطورة الكلية</span>
                  <span className="text-xl font-black text-red-500">{activeCase.trust_decision?.risk_score || 0}%</span>
                </div>
              </div>

              <div className="p-3.5 bg-brand-orange-500/10 border border-brand-orange-500/25 rounded-lg text-xs space-y-2 text-brand-orange-500">
                <strong className="block font-bold">التوصية النهائية للامتثال:</strong>
                <p className={`leading-relaxed text-[11px] font-medium ${isDarkMode ? "text-gray-300" : "text-slate-700"}`}>
                  {activeCase.trust_decision?.reasoning || "في انتظار المعالجة الذكية للقضية لحساب التوصية."}
                </p>
              </div>

              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-mono text-slate-400 font-bold block uppercase">موجز العوامل المساهمة بالقرار المالي:</span>
                {activeCase.trust_decision?.contributing_factors.map((f, i) => (
                  <div key={i} className="flex gap-2 text-slate-500 font-medium text-[11px]">
                    <span className="text-brand-orange-500 font-bold shrink-0">◀</span>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
