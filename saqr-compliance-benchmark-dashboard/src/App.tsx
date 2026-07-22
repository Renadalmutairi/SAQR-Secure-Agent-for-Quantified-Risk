/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Terminal as TerminalIcon,
  Settings,
  Activity,
  Award,
  Database,
  Coins,
  Sun,
  Moon,
  Cpu,
  Layers,
  RefreshCw,
  Workflow
} from 'lucide-react';
import { mockEngine } from './components/MockEngine';
import { InteractiveForm } from './components/InteractiveForm';
import { StageResultView } from './components/StageResultView';
import { TimelineView } from './components/TimelineView';
import { GraphCanvas } from './components/GraphCanvas';
import { BenchmarkSection } from './components/BenchmarkSection';
import { SystemReadiness } from './components/SystemReadiness';
import { motion, AnimatePresence } from 'motion/react';
import { SourceBadge } from './components/MetricCard';
import {
  TransactionInput,
  StageResult,
  TimelineEvent,
  RelationshipGraph,
  BenchmarkJob,
  BenchmarkReport,
  ReadinessItem,
  StageName,
  BenchmarkKind
} from './types';

export default function App() {
  // Theme State (Dark vs Light)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // App Navigation Tabs
  const [activeTab, setActiveTab] = useState<'run' | 'benchmarks' | 'readiness'>('run');

  // Connection mode: 'simulation' | 'live'
  // Defaults to live + same-origin: this dashboard is served by nginx on the same
  // origin as /api/*, so an empty base means "this host" - no CORS, no hardcoded port.
  const [connectionMode, setConnectionMode] = useState<'simulation' | 'live'>('live');
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('');
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Health and DB states
  const [isDbOnline, setIsDbOnline] = useState<boolean>(true);
  const [isOutageActive, setIsOutageActive] = useState<boolean>(false);
  const [isHealthOk, setIsHealthOk] = useState<boolean>(true);
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);

  // Demo Run Transaction State
  const [isDemoRunning, setIsDemoRunning] = useState<boolean>(false);
  const [demoStages, setDemoStages] = useState<StageResult[]>([]);
  const [demoTimeline, setDemoTimeline] = useState<TimelineEvent[]>([]);
  const [demoGraph, setDemoGraph] = useState<RelationshipGraph | null>(null);
  const [activeStageTab, setActiveStageTab] = useState<StageName>('behavioral');

  // Interactive logs console
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  // Token History state
  const [historyTokens, setHistoryTokens] = useState<string[]>([]);
  const [activeToken, setActiveToken] = useState<string | null>(null);

  // Benchmark State
  const [activeJobs, setActiveJobs] = useState<BenchmarkJob[]>([]);
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkReport | null>(null);
  const [isRefreshingReport, setIsRefreshingReport] = useState<boolean>(false);

  // Sync theme attribute to :root[data-theme]
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.setAttribute('data-theme', 'dark');
      document.body.className = 'bg-[#050505] text-[#e0e0e0] font-sans antialiased selection:bg-[#c5a059]/20 selection:text-[#c5a059] transition-colors duration-200';
    } else {
      root.setAttribute('data-theme', 'light');
      document.body.className = 'bg-[#fafaf9] text-[#1c1917] font-sans antialiased selection:bg-[#c5a059]/20 selection:text-[#c5a059] transition-colors duration-200';
    }
  }, [isDarkMode]);

  // Load initial token ledger and report on startup
  useEffect(() => {
    if (connectionMode === 'simulation') {
      setHistoryTokens(mockEngine.getTokensList().reverse());
      setBenchmarkReport(mockEngine.getReport());
    } else {
      refreshLiveReport();
    }
    checkSystemHealth();
  }, [connectionMode]);

  // Polling loop for system health & db-status (every ~4 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      checkSystemHealth();
    }, 4000);
    return () => clearInterval(interval);
  }, [connectionMode, apiBaseUrl]);

  // Polling loop for active running jobs
  useEffect(() => {
    if (activeJobs.length === 0) return;

    const interval = setInterval(async () => {
      const updatedJobs = await Promise.all(
        activeJobs.map(async (job) => {
          if (job.status !== 'running') return job;

          if (connectionMode === 'simulation') {
            const updated = mockEngine.getJob(job.job_id);
            if (updated && updated.status !== 'running') {
              // Trigger a report update upon completion
              setTimeout(() => {
                setBenchmarkReport(mockEngine.getReport());
              }, 100);
            }
            return updated || job;
          } else {
            // Live backend polling
            try {
              const res = await fetch(`${apiBaseUrl}/api/benchmark/jobs/${job.job_id}`);
              if (res.ok) {
                const updated: BenchmarkJob = await res.json();
                if (updated.status !== 'running') {
                  // Trigger report update
                  setTimeout(() => refreshLiveReport(), 500);
                }
                return updated;
              }
            } catch (e) {
              console.error('Failed polling live job status', e);
            }
            return job;
          }
        })
      );

      // Filter out completed/failed jobs from active poll tracking after a short delay
      setActiveJobs(updatedJobs.filter(j => j.status === 'running'));
    }, 1200);

    return () => clearInterval(interval);
  }, [activeJobs, connectionMode, apiBaseUrl]);

  // Health check worker
  const checkSystemHealth = async () => {
    if (isCheckingHealth) return;
    setIsCheckingHealth(true);

    if (connectionMode === 'simulation') {
      setIsDbOnline(!mockEngine.isOutage());
      setIsOutageActive(mockEngine.isOutage());
      setIsHealthOk(true);
      setIsCheckingHealth(false);
    } else {
      try {
        const [healthRes, dbRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/health`).catch(() => null),
          fetch(`${apiBaseUrl}/api/db-status`).catch(() => null)
        ]);

        if (healthRes && healthRes.ok) {
          setIsHealthOk(true);
        } else {
          setIsHealthOk(false);
        }

        if (dbRes && dbRes.ok) {
          const dbData = await dbRes.json();
          const online = dbData.database === 'online';
          setIsDbOnline(online);
          setIsOutageActive(!online);
        } else {
          setIsDbOnline(false);
          setIsOutageActive(true);
        }
      } catch (e) {
        setIsHealthOk(false);
        setIsDbOnline(false);
        setIsOutageActive(true);
      } finally {
        setIsCheckingHealth(false);
      }
    }
  };

  // Pull live metrics report from backend
  const refreshLiveReport = async () => {
    if (connectionMode === 'simulation') {
      setBenchmarkReport(mockEngine.getReport());
      return;
    }

    setIsRefreshingReport(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/benchmark/report`);
      if (res.ok) {
        const data: BenchmarkReport = await res.json();
        setBenchmarkReport(data);
      } else {
        console.error('Failed fetching live report', res.statusText);
      }
    } catch (e) {
      console.error('Error contacting live report API', e);
    } finally {
      setIsRefreshingReport(false);
    }
  };

  // Trigger Demo Run Action
  const handleRunDemoTransaction = async (input: TransactionInput) => {
    if (isDemoRunning) return;
    setIsDemoRunning(true);
    setConsoleLogs([]);
    setActiveStageTab('behavioral');

    // Setup active state arrays
    setDemoStages([
      { stage: 'behavioral', status: 'running', error: null, duration_ms: 0, result: null },
      { stage: 'graph', status: 'pending', error: null, duration_ms: 0, result: null },
      { stage: 'trust', status: 'pending', error: null, duration_ms: 0, result: null },
      { stage: 'compliance', status: 'pending', error: null, duration_ms: 0, result: null },
      { stage: 'decision', status: 'pending', error: null, duration_ms: 0, result: null }
    ]);

    const addLog = (log: string) => {
      setConsoleLogs((prev) => [...prev, `[${new Date().toLocaleTimeString([], { hour12: false })}] ${log}`]);
    };

    addLog(`Initiating transaction orchestration workflow...`);

    if (connectionMode === 'simulation') {
      // Execute simulated runner
      await mockEngine.simulateDemoRun(input, (updatedResponse, currentStage, message) => {
        setDemoStages(updatedResponse.stages);
        setDemoTimeline(mockEngine.getTimeline(updatedResponse.token));
        setDemoGraph(mockEngine.getGraph(updatedResponse.token));
        setActiveToken(updatedResponse.token);
        setHistoryTokens(mockEngine.getTokensList().reverse());

        if (currentStage !== 'done') {
          setActiveStageTab(currentStage);
          addLog(`[Stage: ${currentStage.toUpperCase()}] ${message}`);
        } else {
          setIsDemoRunning(false);
          addLog(message);
        }
      });
    } else {
      // Live backend execution
      addLog(`Posting transaction variables to ${apiBaseUrl}/api/demo/run...`);
      try {
        const response = await fetch(`${apiBaseUrl}/api/demo/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });

        if (response.ok) {
          const runRes: any = await response.json();
          addLog(`Sequence executed successfully. Token generated: ${runRes.token}`);

          // Set complete stages and fetch graph/timeline
          setDemoStages(runRes.stages || []);
          setActiveToken(runRes.token);

          // Get timeline and relationship graph
          await Promise.all([
            fetch(`${apiBaseUrl}/api/tokens/${runRes.token}/timeline`)
              .then(res => res.ok ? res.json() : [])
              .then(data => setDemoTimeline(data)),
            fetch(`${apiBaseUrl}/api/graph/${runRes.token}`)
              .then(res => res.ok ? res.json() : null)
              .then(data => setDemoGraph(data))
          ]);

          setIsDemoRunning(false);
          addLog(`Consensus resolution processed completely.`);
        } else {
          // Failure response
          const errText = await response.text();
          addLog(`CRITICAL ERROR during sequence: ${errText}`);
          setIsDemoRunning(false);
        }
      } catch (e: any) {
        addLog(`NETWORK TIMEOUT / CONNECTION REFUSED: ${e.message}`);
        setIsDemoRunning(false);
      }
    }
  };

  // Load a previously created token's full details
  const handleSelectHistoryToken = async (token: string) => {
    setActiveToken(token);
    if (connectionMode === 'simulation') {
      const run = mockEngine.getToken(token);
      if (run) {
        setDemoStages(run.stages);
        setDemoTimeline(mockEngine.getTimeline(token));
        setDemoGraph(mockEngine.getGraph(token));
      }
    } else {
      try {
        const [tokenRes, timelineRes, graphRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/tokens/${token}`).then(res => res.ok ? res.json() : null),
          fetch(`${apiBaseUrl}/api/tokens/${token}/timeline`).then(res => res.ok ? res.json() : []),
          fetch(`${apiBaseUrl}/api/graph/${token}`).then(res => res.ok ? res.json() : null)
        ]);

        if (tokenRes) {
          setDemoStages(tokenRes.stage_results || []);
        }
        setDemoTimeline(timelineRes);
        setDemoGraph(graphRes);
      } catch (e) {
        console.error('Failed loading history token details', e);
      }
    }
  };

  // Trigger Operation Benchmark
  const handleTriggerBenchmark = async (kind: BenchmarkKind, params: any): Promise<BenchmarkJob> => {
    if (connectionMode === 'simulation') {
      const job = mockEngine.startBenchmark(kind, params);
      setActiveJobs((prev) => [...prev, job]);
      return job;
    } else {
      const endpoint = kind === 'pipeline' 
        ? 'pipeline/run' 
        : kind === 'tokens' 
        ? 'tokens/run' 
        : 'db/run';

      try {
        const res = await fetch(`${apiBaseUrl}/api/benchmark/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });

        if (res.ok) {
          const job: BenchmarkJob = await res.json();
          setActiveJobs((prev) => [...prev, job]);
          return job;
        } else {
          throw new Error(`Failed triggering live benchmark: ${res.statusText}`);
        }
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
  };

  // Handle resilience outage start/stop toggle
  const handleToggleOutage = async (active: boolean) => {
    if (connectionMode === 'simulation') {
      mockEngine.setOutage(active);
      setIsDbOnline(!active);
      setIsOutageActive(active);
    } else {
      const path = active ? 'start' : 'end';
      try {
        const res = await fetch(`${apiBaseUrl}/api/benchmark/tokens/outage/${path}`, {
          method: 'POST'
        });
        if (res.ok) {
          setIsDbOnline(!active);
          setIsOutageActive(active);
        } else {
          throw new Error('Outage endpoint rejected trigger');
        }
      } catch (e) {
        console.error('Failed to trigger live outage operator control', e);
      }
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Navigation Headers & Menu bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/85 bg-white/95 backdrop-blur dark:border-white/5 dark:bg-[#080808]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <Workflow size={22} className="text-[#c5a059] animate-pulse" />
            <div>
              <h1 className="font-serif text-2xl italic tracking-tight text-[#c5a059]">
                SAQR <span className="font-serif italic font-light text-slate-400">Orchestrator</span>
              </h1>
              <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-[0.25em]">
                SAMA Compliance &amp; Benchmark Suite
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status light */}
            <div className="flex items-center gap-2 rounded bg-slate-100/80 px-3 py-1 text-[10px] font-semibold text-slate-500 dark:bg-[#0c0c0c] dark:border dark:border-white/5 dark:text-white/40">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${isDbOnline ? 'bg-[#4ade80]' : 'bg-rose-500 animate-ping'}`} />
              <span className="font-mono tracking-wider">{isDbOnline ? 'DB: ONLINE' : 'DB: OFFLINE'}</span>
            </div>

            {/* Mode switch pills */}
            <div className="flex rounded border border-slate-200/80 bg-slate-100 p-0.5 dark:border-white/5 dark:bg-[#0c0c0c]">
              <button
                onClick={() => setConnectionMode('simulation')}
                className={`rounded px-2.5 py-1 text-[10px] font-bold tracking-wide transition-all ${
                  connectionMode === 'simulation'
                    ? 'bg-white shadow text-slate-900 dark:bg-[#c5a059] dark:text-black'
                    : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-[#e0e0e0]'
                }`}
              >
                SIMULATION
              </button>
              <button
                onClick={() => setConnectionMode('live')}
                className={`rounded px-2.5 py-1 text-[10px] font-bold tracking-wide transition-all ${
                  connectionMode === 'live'
                    ? 'bg-white shadow text-slate-900 dark:bg-[#c5a059] dark:text-black'
                    : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-[#e0e0e0]'
                }`}
              >
                LIVE PORT 8080
              </button>
            </div>

            {/* Settings Toggle */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="rounded border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 dark:border-white/5 dark:bg-[#0c0c0c] dark:text-white/40 dark:hover:text-[#e0e0e0]"
              title="API Endpoint Configuration"
            >
              <Settings size={14} className={showSettings ? 'rotate-45 transition-transform' : 'transition-transform'} />
            </button>

            {/* Dark Mode toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="rounded border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50 dark:border-white/5 dark:bg-[#0c0c0c] dark:text-white/40 dark:hover:text-[#e0e0e0]"
            >
              {isDarkMode ? <Sun size={14} className="text-[#c5a059]" /> : <Moon size={14} />}
            </button>
          </div>
        </div>
      </header>

      {/* Settings Modal Bar */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-slate-200/60 bg-slate-50/80 dark:border-white/5 dark:bg-[#080808]/90 overflow-hidden"
          >
            <div className="mx-auto max-w-7xl px-4 py-3.5 md:px-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={14} className="text-amber-500" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Target Deployed Dashboard: Configure the API origin base for live CORS fetches.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="http://localhost:8080"
                  className="rounded border border-slate-250 bg-white px-2.5 py-1 font-mono text-xs focus:border-[#c5a059] focus:outline-none dark:border-white/5 dark:bg-[#0c0c0c] dark:text-[#e0e0e0]"
                />
                <button
                  onClick={checkSystemHealth}
                  className="rounded bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-slate-800 dark:bg-[#c5a059] dark:text-black dark:hover:bg-[#b48e47]"
                >
                  RE-TEST HEALTH
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content body wrapper */}
      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {/* Connection health warning */}
        {connectionMode === 'live' && !isHealthOk && (
          <div className="mb-6 rounded border border-rose-100 bg-rose-500/5 p-4 dark:border-rose-950/20">
            <div className="flex gap-3">
              <ShieldAlert className="text-rose-500 shrink-0" size={18} />
              <div>
                <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">Live Host Endpoint Unreachable</h4>
                <p className="mt-1 text-xs text-rose-600 dark:text-rose-500 leading-relaxed font-sans">
                  The dashboard frontend could not reach the SAQR API base at <span className="font-mono font-bold bg-rose-500/10 px-1 py-0.5 rounded">{apiBaseUrl}</span>.
                  Verify that your backend Docker services on port <span className="font-bold">8080</span> are fully launched, or switch the toggle to <span className="font-bold text-slate-800 dark:text-[#E7EAF2]">"SIMULATION"</span> to experience the fully functional mock sandbox environment instantly!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Core Tab Navigation */}
        <div className="mb-6 flex gap-1 bg-slate-100 p-1 rounded w-fit dark:bg-[#0c0c0c] border dark:border-white/5">
          <button
            onClick={() => setActiveTab('run')}
            className={`px-4.5 py-2 text-xs font-bold rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'run'
                ? 'bg-white shadow text-slate-900 dark:bg-[#c5a059] dark:text-black'
                : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-[#e0e0e0]'
            }`}
          >
            <Cpu size={13} />
            <span className="uppercase tracking-[0.2em] text-[10px]">Token Generation Station</span>
          </button>
          <button
            onClick={() => setActiveTab('benchmarks')}
            className={`px-4.5 py-2 text-xs font-bold rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'benchmarks'
                ? 'bg-white shadow text-slate-900 dark:bg-[#c5a059] dark:text-black'
                : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-[#e0e0e0]'
            }`}
          >
            <Activity size={13} />
            <span className="uppercase tracking-[0.2em] text-[10px]">Benchmark &amp; Resiliences</span>
          </button>
          <button
            onClick={() => setActiveTab('readiness')}
            className={`px-4.5 py-2 text-xs font-bold rounded transition-all flex items-center gap-1.5 ${
              activeTab === 'readiness'
                ? 'bg-white shadow text-slate-900 dark:bg-[#c5a059] dark:text-black'
                : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-[#e0e0e0]'
            }`}
          >
            <Coins size={13} />
            <span className="uppercase tracking-[0.2em] text-[10px]">Readiness &amp; TCO Costs</span>
          </button>
        </div>

        {/* Tab view panes */}
        <div>
          {activeTab === 'run' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Token Parameters Panel */}
              <InteractiveForm
                onRun={handleRunDemoTransaction}
                isRunning={isDemoRunning}
                isDbOnline={isDbOnline}
                historyTokens={historyTokens}
                activeToken={activeToken}
                onSelectToken={handleSelectHistoryToken}
                logs={consoleLogs}
              />

              {/* Grid: 2-node graph + Timeline view */}
              <div className="grid gap-6 md:grid-cols-12">
                <div className="md:col-span-8">
                  <StageResultView
                    stages={demoStages}
                    activeStageTab={activeStageTab}
                    onTabChange={setActiveStageTab}
                  />
                </div>
                <div className="md:col-span-4 space-y-6">
                  <GraphCanvas graphData={demoGraph} isLoading={isDemoRunning && activeStageTab === 'graph'} />
                  <TimelineView
                    timeline={demoTimeline}
                    isCompleted={demoStages.find(s => s.stage === 'decision')?.status === 'completed'}
                    isFailed={demoStages.some(s => s.status === 'failed')}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'benchmarks' && (
            <div className="animate-fadeIn">
              <BenchmarkSection
                onTriggerBenchmark={handleTriggerBenchmark}
                activeJobs={activeJobs}
                report={benchmarkReport}
                onRefreshReport={refreshLiveReport}
                isOutageActive={isOutageActive}
                onToggleOutage={handleToggleOutage}
                isRefreshingReport={isRefreshingReport}
              />
            </div>
          )}

          {activeTab === 'readiness' && benchmarkReport && (
            <div className="space-y-6 animate-fadeIn">
              {/* Checklist panel */}
              <SystemReadiness items={benchmarkReport.readiness} />

              {/* Small comparison stats row */}
              {benchmarkReport.infra_cost && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded border border-slate-200/50 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider block mb-1">Total Allocated Tables</span>
                    <span className="font-mono text-2xl font-black text-[#c5a059]">3 Tables</span>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-white/30 font-medium">shared across all 5 independent agents</p>
                  </div>
                  <div className="rounded border border-slate-200/50 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider block mb-1">Physical DB Size</span>
                    <span className="font-mono text-2xl font-black text-slate-800 dark:text-[#e0e0e0]">
                      {(benchmarkReport.infra_cost.database_size_bytes / (1024 * 1024)).toFixed(2)} MB
                    </span>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-white/30 font-medium">compact disk consumption (measured)</p>
                  </div>
                  <div className="rounded border border-slate-200/50 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
                    <span className="text-[10px] font-bold text-slate-400 dark:text-white/40 uppercase tracking-wider block mb-1">Estimated Monthly USD</span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-2xl font-black text-slate-800 dark:text-[#e0e0e0]">
                        ${benchmarkReport.infra_cost.estimated_monthly_cost_usd.value.toFixed(2)}
                      </span>
                      <SourceBadge source={benchmarkReport.infra_cost.estimated_monthly_cost_usd.source} />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-white/30 font-medium">average container compute bill (formula)</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'readiness' && !benchmarkReport && (
            <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-white/5 dark:bg-[#0c0c0c]">
              <RefreshCw size={24} className="mb-2 text-slate-400 animate-spin" />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Loading system readiness specs...</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
