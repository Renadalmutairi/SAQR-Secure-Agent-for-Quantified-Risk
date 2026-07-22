import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Briefcase, 
  Network, 
  Cpu, 
  FileText, 
  Bell, 
  Settings, 
  Menu, 
  X,
  AlertOctagon,
  ShieldCheck,
  Building,
  User,
  LogOut,
  Sun,
  Moon,
  Lock,
  KeyRound,
  MessageSquare,
  Bot
} from "lucide-react";

import { mockCases, mockAlerts } from "./data/mockData";
import { InvestigationState, Alert } from "./types";
import { SaqrLogoIcon, SaqrFullLogo } from "./components/SaqrLogo";
import { runRealInvestigation, checkDbStatus } from "./api/saqrClient";

import Dashboard from "./components/Dashboard";
import NetworkGraph from "./components/NetworkGraph";
import AgentPipeline from "./components/AgentPipeline";
import Workspace from "./components/Workspace";
import Reports from "./components/Reports";
import ChatbotDrawer from "./components/ChatbotDrawer";

export interface SaudiUser {
  id: string;
  name: string;
  station: string;
  email: string;
}

// JLIST of all work stations in Saudi Arabia - Restricted to Alinma Bank only
const SAUDI_WORK_STATIONS = [
  "مصرف الإنماء - الإدارة العامة للالتزام ومكافحة غسل الأموال (المركز الرئيسي)"
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<string>("dashboard");
  const [cases, setCases] = useState<InvestigationState[]>(mockCases);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [activeCaseId, setActiveCaseId] = useState<string>("SAQR-2026-9041");
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showChatbot, setShowChatbot] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  
  // Theme state - "make it light" as default (isDarkMode: false)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Authentication state
  const [user, setUser] = useState<SaudiUser | null>(() => {
    const saved = localStorage.getItem("saqr_user");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  // Login form fields
  const [loginName, setLoginName] = useState<string>("ريناد جزاع المطيري");
  const [loginId, setLoginId] = useState<string>("1094820194");
  const [loginEmail, setLoginEmail] = useState<string>("renad.mutairi@alinma.com");
  const [loginStation, setLoginStation] = useState<string>(SAUDI_WORK_STATIONS[0]);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Helper to fetch active case details
  const activeCase = cases.find(c => c.case_id === activeCaseId) || cases[0];

  // --- Real backend connection (live SAQR 5-agent pipeline) ---
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [isRunningReal, setIsRunningReal] = useState<boolean>(false);
  useEffect(() => {
    checkDbStatus().then(setBackendOnline);
    const interval = setInterval(() => checkDbStatus().then(setBackendOnline), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRunRealInvestigation = async () => {
    const account_id = window.prompt("Sender account_id (real, e.g. 959):", "959");
    if (!account_id) return;
    const receiver_account_id = window.prompt("Receiver account_id (real, e.g. 450):", "450");
    if (!receiver_account_id) return;
    const amountStr = window.prompt("Amount (SAR):", "500");
    if (!amountStr) return;
    setIsRunningReal(true);
    try {
      const realCase = await runRealInvestigation({
        account_id, receiver_account_id, amount: parseFloat(amountStr), tx_type: "TRANSFER",
      });
      setCases(prev => [realCase, ...prev]);
      setActiveCaseId(realCase.case_id);
      setCurrentPage("workspace");
    } catch (e: any) {
      alert(`Real backend call failed: ${e.message}`);
    } finally {
      setIsRunningReal(false);
    }
  };

  // Callback to update custom case states (comments, pipeline status, report drafts)
  const handleUpdateCase = (updatedCase: InvestigationState) => {
    setCases(prev => prev.map(c => c.case_id === updatedCase.case_id ? updatedCase : c));
  };

  // Callback to select a case and direct to Workspace
  const handleSelectCase = (caseId: string) => {
    setActiveCaseId(caseId);
    setCurrentPage("workspace");
    setMobileMenuOpen(false);
  };

  // Switch case and stay on page
  const handleSelectCaseById = (caseId: string) => {
    setActiveCaseId(caseId);
  };

  // Helper to count unread notifications
  const unreadAlertsCount = alerts.filter(a => a.unread).length;

  // Mark alerts as read
  const handleMarkAllAlertsRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, unread: false })));
  };

  // Handle Login submission
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) {
      setLoginError("الرجاء إدخال الاسم الثلاثي.");
      return;
    }
    if (!loginId.trim() || loginId.length < 10) {
      setLoginError("الرجاء إدخال رقم هوية وطنية صحيح (10 أرقام).");
      return;
    }
    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setLoginError("الرجاء إدخال بريد إلكتروني رسمي صحيح لمصرف الإنماء.");
      return;
    }
    if (!loginStation) {
      setLoginError("الرجاء اختيار جهة العمل من القائمة.");
      return;
    }

    const newUser: SaudiUser = {
      id: loginId,
      name: loginName,
      station: loginStation,
      email: loginEmail
    };

    setUser(newUser);
    localStorage.setItem("saqr_user", JSON.stringify(newUser));
    setLoginError(null);
  };

  // Handle Logout
  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("saqr_user");
  };

  // If investigator is not authenticated, render the Secure Login Portal
  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 font-sans select-none dir-rtl ${
        isDarkMode ? "bg-[#090a0c] text-white" : "bg-[#f8fafc] text-slate-800"
      }`} dir="rtl">
        {/* Decorative Theme Switch in Login */}
        <div className="absolute top-6 left-6">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              isDarkMode 
                ? "bg-[#111317] border-[#22262f] text-yellow-400 hover:bg-[#171a21]" 
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <div className="w-full max-w-xl flex flex-col gap-6">
          {/* Brand Header */}
          <div className="text-center flex flex-col items-center justify-center">
            <SaqrFullLogo className="w-full max-w-lg" isDarkMode={isDarkMode} />
          </div>

          {/* Login Card */}
          <div className={`border rounded-2xl p-6 md:p-8 space-y-6 shadow-xl ${
            isDarkMode ? "bg-[#111317] border-[#22262f]" : "bg-white border-slate-200"
          }`}>
            <div className="flex items-center gap-2 border-b pb-4 border-current/10">
              <KeyRound className="w-5 h-5 text-brand-orange-500" />
              <h2 className="text-base font-bold">تسجيل الدخول الموحد (Unified Secure Access)</h2>
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-3 rounded-lg text-right">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4 text-right">
              {/* Name field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">الاسم الثلاثي للموظف (مفتوح):</label>
                <div className="relative">
                  <span className="absolute right-3 top-2.5 text-slate-400"><User className="w-4 h-4" /></span>
                  <input 
                    type="text"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder="ريناد جزاع المطيري"
                    className={`w-full text-xs rounded-lg pl-3 pr-9 py-2.5 border focus:border-brand-orange-500 focus:outline-none transition-colors ${
                      isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  />
                </div>
              </div>

              {/* National ID Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 font-mono">رقم الهوية الوطنية (١٠ أرقام):</label>
                <div className="relative">
                  <span className="absolute right-3 top-2.5 text-slate-400"><Lock className="w-4 h-4" /></span>
                  <input 
                    type="text"
                    maxLength={10}
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value.replace(/\D/g, ""))}
                    placeholder="1094820194"
                    className={`w-full text-xs rounded-lg pl-3 pr-9 py-2.5 border focus:border-brand-orange-500 focus:outline-none transition-colors font-mono ${
                      isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  />
                </div>
              </div>

              {/* Work Email Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">البريد الإلكتروني للعمل:</label>
                <div className="relative">
                  <span className="absolute right-3 top-2.5 text-slate-400"><FileText className="w-4 h-4 text-slate-400" /></span>
                  <input 
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="renad.mutairi@alinma.com"
                    className={`w-full text-xs rounded-lg pl-3 pr-9 py-2.5 border focus:border-brand-orange-500 focus:outline-none transition-colors font-mono ${
                      isDarkMode ? "bg-[#090a0c] border-[#22262f] text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                    }`}
                  />
                </div>
              </div>

              {/* Saudi Work Stations JLIST (Vertical Scroll Select) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400">جهة العمل والامتثال الرقابي (JLIST):</label>
                <p className="text-[10px] text-slate-500">اختر محطة الالتزام النشطة للتحري المالي في المملكة العربية السعودية:</p>
                <div 
                  className={`border rounded-lg overflow-y-auto h-40 font-sans text-xs divide-y transition-colors ${
                    isDarkMode ? "bg-[#090a0c] border-[#22262f] divide-[#22262f]" : "bg-slate-50 border-slate-200 divide-slate-200"
                  }`}
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {SAUDI_WORK_STATIONS.map((station, i) => {
                    const isSelected = loginStation === station;
                    return (
                      <div 
                        key={i}
                        onClick={() => setLoginStation(station)}
                        className={`p-3 text-right cursor-pointer transition-all flex items-center justify-between ${
                          isSelected 
                            ? "bg-brand-orange-500/10 text-brand-orange-500 font-bold border-r-4 border-brand-orange-500" 
                            : isDarkMode ? "text-gray-300 hover:bg-[#111317]" : "text-slate-700 hover:bg-slate-100/80"
                        }`}
                      >
                        <span>{station}</span>
                        {isSelected && <span className="text-[10px] bg-brand-orange-500 text-black px-1.5 py-0.5 rounded font-bold shrink-0">نشط</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit"
                className="w-full bg-brand-orange-500 hover:bg-brand-orange-600 text-black font-extrabold py-3 rounded-lg text-sm transition-all cursor-pointer shadow-lg shadow-brand-orange-500/10 mt-2 flex items-center justify-center gap-1.5"
              >
                <span>دخول آمن للمنصة الاستخباراتية</span>
                <ShieldCheck className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans flex flex-col md:flex-row antialiased select-none transition-colors duration-200 ${
      isDarkMode ? "bg-[#090a0c] text-gray-200" : "bg-slate-50 text-slate-800"
    }`} id="saqr-main-container" dir="rtl">
      
      {/* MOBILE HEADER */}
      <header className={`md:hidden px-5 py-4 flex justify-between items-center z-50 w-full border-b ${
        isDarkMode ? "bg-[#111317] border-[#22262f]" : "bg-white border-slate-200"
      }`} id="saqr-mobile-header">
        <div className="flex items-center gap-2.5">
          <SaqrLogoIcon className="w-9 h-9 shrink-0" isDarkMode={isDarkMode} />
          <div>
            <h1 className={`font-extrabold text-sm ${isDarkMode ? "text-white" : "text-slate-800"}`}>منصة صقر الاستخباراتية</h1>
            <span className="text-[9px] text-slate-400 font-mono tracking-wider block">SAQR Financial Intel</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Global Smart Chatbot Toggle */}
          <button 
            onClick={() => setShowChatbot(!showChatbot)}
            className={`p-1.5 border rounded-lg transition-all cursor-pointer ${
              showChatbot
                ? "bg-brand-orange-500/20 border-brand-orange-500 text-brand-orange-500"
                : isDarkMode 
                  ? "bg-[#090a0c] hover:bg-[#171a21] border-[#22262f] text-gray-400 hover:text-white" 
                  : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500"
            }`}
            title="مساعد صقر الذكي"
          >
            <Bot className="w-4 h-4" />
          </button>

          {/* Bell Notifications */}
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-1.5 border rounded-lg transition-all ${
              isDarkMode 
                ? "bg-[#090a0c] hover:bg-[#171a21] border-[#22262f] text-gray-400 hover:text-white" 
                : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500"
            }`}
          >
            <Bell className="w-4 h-4" />
            {unreadAlertsCount > 0 && (
              <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-mono text-white flex items-center justify-center">
                {unreadAlertsCount}
              </span>
            )}
          </button>

          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 border border-transparent rounded-lg text-slate-400"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* SIDEBAR FOR DESKTOP & MOBILE TRANSITIONS */}
      <aside className={`fixed md:relative inset-y-0 right-0 z-40 w-64 border-l flex flex-col justify-between transform transition-transform duration-300 md:transform-none ${
        isDarkMode ? "bg-[#111317] border-[#22262f]" : "bg-white border-slate-200"
      } ${
        mobileMenuOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
      }`} id="saqr-sidebar">
        <div className="space-y-6 p-5">
          
          {/* LOGO AND BRANDING */}
          <div className="flex items-center gap-3 pb-5 border-b border-current/10" id="saqr-brand-section">
            <SaqrLogoIcon className="w-11 h-11 shrink-0" isDarkMode={isDarkMode} />
            <div>
              <div className="flex items-center gap-1">
                <h1 className={`text-base font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-800"}`}>منصة صـقـر</h1>
                <span className="text-[9px] bg-red-600/15 border border-red-500/30 text-red-500 px-1 py-0.5 rounded font-mono font-bold animate-pulse">SAMA</span>
              </div>
              <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">الامتثال • مصرف الإنماء</p>
            </div>
          </div>

          {/* MAIN NAVIGATION LINKS */}
          <nav className="space-y-1.5" id="saqr-sidebar-nav">
            {[
              { id: "dashboard", label: "الرئيسية والمراقبة", icon: <LayoutDashboard className="w-4 h-4" /> },
              { id: "workspace", label: "غرفة التحقيق والعمليات", icon: <Briefcase className="w-4 h-4" /> },
              { id: "graph", label: "Financial Relationship Graph", icon: <Network className="w-4 h-4" /> },
              { id: "pipeline", label: "محاكي خطوط المعالجة", icon: <Cpu className="w-4 h-4" /> },
              { id: "reports", label: "التقارير والرفع الرقابي", icon: <FileText className="w-4 h-4" /> }
            ].map(item => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-right px-3.5 py-3 rounded-lg flex items-center gap-3 transition-all cursor-pointer ${
                    isActive 
                      ? "bg-brand-orange-500/10 text-brand-orange-500 border-r-4 border-brand-orange-500 font-bold" 
                      : isDarkMode 
                        ? "text-gray-400 hover:text-white hover:bg-[#090a0c]/50" 
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <span className={`${isActive ? "text-brand-orange-500" : "text-slate-400"}`}>{item.icon}</span>
                  <span className="text-xs">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* FOOTER USER SIGN-IN METRICS */}
        <div className="p-5 border-t border-current/10 space-y-3" id="sidebar-footer-credentials">
          <div className={`flex items-center gap-2.5 p-2.5 border rounded-lg ${
            isDarkMode ? "bg-[#090a0c]/50 border-[#22262f]" : "bg-slate-50 border-slate-200"
          }`}>
            <div className="w-8 h-8 rounded-full bg-brand-orange-500/10 border border-brand-orange-500/30 text-brand-orange-500 flex items-center justify-center font-bold text-xs shrink-0 select-none">
              {user.name.substring(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <span className={`text-[11px] font-bold block truncate ${isDarkMode ? "text-gray-100" : "text-slate-800"}`}>{user.name}</span>
              <span className="text-[9px] text-slate-400 block truncate font-sans">{user.station.split(" - ")[0]}</span>
              <span className="text-[8px] text-slate-500 block truncate font-mono">الهوية: {user.id}</span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1 hover:text-brand-orange-500 transition-colors font-sans cursor-pointer text-slate-500"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج</span>
            </button>
            <span className="flex items-center gap-1 text-emerald-500 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>مؤمن</span>
            </span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA CONTAINER */}
      <main className="flex-1 min-w-0 p-4 md:p-8 space-y-6 overflow-y-auto max-h-screen" id="saqr-main-view">
        
        {/* DESKTOP HEADER ACTION BAR */}
        <div className={`hidden md:flex justify-between items-center pb-4 border-b ${
          isDarkMode ? "border-[#22262f]" : "border-slate-200"
        }`} id="saqr-desktop-header">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className={`border px-2.5 py-1 rounded ${
              isDarkMode ? "bg-[#111317] border-[#22262f] text-gray-300" : "bg-white border-slate-200 text-slate-700"
            }`}>
              الجهة: {user.station}
            </span>
            <span>بيئة تحقيق نشطة وموحدة</span>
          </div>

          <div className="flex items-center gap-4 relative">
            {/* REAL backend connection status + live investigation trigger */}
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border ${
                backendOnline ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5" : "text-red-500 border-red-500/30 bg-red-500/5"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}></span>
                {backendOnline ? "SAQR Backend: Online" : "SAQR Backend: Offline"}
              </span>
              <button
                onClick={handleRunRealInvestigation}
                disabled={!backendOnline || isRunningReal}
                className="text-[10px] font-extrabold px-3 py-1.5 rounded-lg bg-brand-orange-500 text-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Runs a real transaction through the live 5-agent SAQR pipeline"
              >
                {isRunningReal ? "Running live pipeline…" : "+ Real Investigation"}
              </button>
            </div>

            {/* Global Smart Chatbot Toggle */}
            <button 
              onClick={() => setShowChatbot(!showChatbot)}
              className={`p-2 border rounded-lg transition-all cursor-pointer ${
                showChatbot
                  ? "bg-brand-orange-500/25 border-brand-orange-500 text-brand-orange-500 font-bold"
                  : isDarkMode 
                    ? "bg-[#111317] hover:bg-[#171a21] border-[#22262f] text-gray-400 hover:text-white" 
                    : "bg-white hover:bg-slate-50 border-slate-200 text-slate-500"
              }`}
              title="مساعد صقر الذكي التفاعلي"
            >
              <div className="flex items-center gap-1.5">
                <Bot className="w-4 h-4" />
                <span className="text-[10px] font-extrabold hidden lg:inline">اسأل صقر AI</span>
              </div>
            </button>

            {/* Live indicator bell */}
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`relative p-2 border rounded-lg transition-all cursor-pointer ${
                isDarkMode 
                  ? "bg-[#111317] hover:bg-[#171a21] border-[#22262f] text-gray-400 hover:text-white" 
                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-500"
              }`}
            >
              <Bell className="w-4 h-4" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-mono text-white flex items-center justify-center">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {/* NOTIFICATIONS FLOATING POPOVER */}
            {showNotifications && (
              <div className={`absolute left-16 top-12 w-80 rounded-xl shadow-2xl p-4 z-50 animate-fade-in border ${
                isDarkMode ? "bg-[#111317] border-[#22262f] text-white" : "bg-white border-slate-200 text-slate-800"
              }`} id="alerts-popover">
                <div className="flex justify-between items-center pb-2 border-b border-current/10 mb-3 text-xs">
                  <span className="font-bold">بلاغات صقر الفورية</span>
                  <button 
                    onClick={handleMarkAllAlertsRead}
                    className="text-brand-orange-500 hover:underline text-[10px] cursor-pointer font-bold"
                  >
                    تحديد كقروء
                  </button>
                </div>
                
                <div className="space-y-2.5 max-h-[240px] overflow-y-auto" id="alerts-popover-list">
                  {alerts.map(alert => (
                    <div 
                      key={alert.id}
                      className={`p-2.5 rounded border text-right transition-all cursor-pointer ${
                        alert.unread 
                          ? "bg-brand-orange-500/5 border-brand-orange-500/20" 
                          : isDarkMode ? "bg-[#090a0c]/20 border-transparent hover:bg-[#090a0c]" : "bg-slate-50/50 border-transparent hover:bg-slate-100"
                      }`}
                      onClick={() => {
                        handleSelectCase(alert.case_id);
                        setShowNotifications(false);
                      }}
                    >
                      <p className="text-[11px] leading-normal">{alert.message}</p>
                      <span className="text-[9px] text-slate-400 font-mono block mt-1">توقيت البلاغ: {new Date(alert.timestamp).toLocaleTimeString('ar-EG')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Theme Toggle Button */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`p-2 border rounded-lg cursor-pointer transition-all ${
                isDarkMode 
                  ? "bg-[#111317] border-[#22262f] text-yellow-400 hover:bg-[#171a21]" 
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
              title={isDarkMode ? "التبديل للمظهر المضيء" : "التبديل للمظهر الداكن"}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            <div className={`w-px h-6 ${isDarkMode ? "bg-[#22262f]" : "bg-slate-200"}`}></div>

            {/* Authenticated Investigator details */}
            <div className="text-right font-sans">
              <span className="text-[10px] text-slate-400 block uppercase">المحقق المالي النشط</span>
              <span className="text-xs font-bold text-brand-orange-500">{user.name}</span>
            </div>
          </div>
        </div>

        {/* DYNAMIC SCREEN ROUTING */}
        <div id="saqr-rendered-view">
          {currentPage === "dashboard" && (
            <Dashboard 
              cases={cases} 
              alerts={alerts} 
              onSelectCase={handleSelectCase} 
              onNavigate={setCurrentPage}
              isDarkMode={isDarkMode}
            />
          )}

          {currentPage === "workspace" && (
            <Workspace 
              activeCase={activeCase} 
              onUpdateCase={handleUpdateCase}
              onNavigate={setCurrentPage}
              isDarkMode={isDarkMode}
              user={user}
            />
          )}

          {currentPage === "graph" && (
            <NetworkGraph 
              activeCase={activeCase} 
              onSelectCaseById={handleSelectCaseById}
              allCases={cases}
              isDarkMode={isDarkMode}
            />
          )}

          {currentPage === "pipeline" && (
            <AgentPipeline 
              activeCase={activeCase}
              allCases={cases}
              onUpdateCase={handleUpdateCase}
              onSelectCaseById={handleSelectCaseById}
              onNavigate={setCurrentPage}
              isDarkMode={isDarkMode}
            />
          )}

          {currentPage === "reports" && (
            <Reports 
              activeCase={activeCase}
              onUpdateCase={handleUpdateCase}
              allCases={cases}
              onSelectCaseById={handleSelectCaseById}
              isDarkMode={isDarkMode}
              user={user}
            />
          )}
        </div>
      </main>

      {/* Global Interactive Chatbot Slider Drawer */}
      {showChatbot && (
        <ChatbotDrawer 
          activeCase={activeCase}
          user={user}
          isDarkMode={isDarkMode}
          onClose={() => setShowChatbot(false)}
        />
      )}
    </div>
  );
}
