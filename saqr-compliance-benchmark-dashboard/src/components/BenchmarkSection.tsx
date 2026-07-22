/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Activity,
  AlertOctagon,
  Database,
  Coins,
  ShieldCheck,
  Zap,
  BarChart4,
  CheckCircle,
  HelpCircle,
  FileCheck2,
  RefreshCw
} from 'lucide-react';
import { BenchmarkReport, BenchmarkJob, BenchmarkKind } from '../types';
import { LatencyDistribution } from './LatencyDistribution';
import { MetricCard, SourceBadge } from './MetricCard';

interface BenchmarkSectionProps {
  onTriggerBenchmark: (kind: BenchmarkKind, params: any) => Promise<BenchmarkJob>;
  activeJobs: BenchmarkJob[];
  report: BenchmarkReport | null;
  onRefreshReport: () => Promise<void>;
  isOutageActive: boolean;
  onToggleOutage: (active: boolean) => Promise<void>;
  isRefreshingReport: boolean;
}

export const BenchmarkSection: React.FC<BenchmarkSectionProps> = ({
  onTriggerBenchmark,
  activeJobs,
  report,
  onRefreshReport,
  isOutageActive,
  onToggleOutage,
  isRefreshingReport
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'triggers' | 'latency' | 'database' | 'infra' | 'traceability'>('triggers');

  // Trigger forms state
  const [pipeSize, setPipeSize] = useState(1000);
  const [pipeConcurrency, setPipeConcurrency] = useState(20);

  const [tokenTotal, setTokenTotal] = useState(50000);
  const [tokenCustCount, setTokenCustCount] = useState(5000);
  const [tokenConcurrency, setTokenConcurrency] = useState(60);

  const [dbSampleSize, setDbSampleSize] = useState(300);

  const [isOutageTransitioning, setIsOutageTransitioning] = useState(false);

  const handleTrigger = async (kind: BenchmarkKind, e: React.FormEvent) => {
    e.preventDefault();
    let params = {};
    if (kind === 'pipeline') {
      params = { sample_size: pipeSize, concurrency: pipeConcurrency };
    } else if (kind === 'tokens') {
      params = { total: tokenTotal, customer_count: tokenCustCount, concurrency: tokenConcurrency };
    } else if (kind === 'db') {
      params = { sample_size: dbSampleSize };
    }
    await onTriggerBenchmark(kind, params);
  };

  const handleOutageToggleClick = async () => {
    setIsOutageTransitioning(true);
    try {
      await onToggleOutage(!isOutageActive);
    } catch (e) {
      console.error(e);
    } finally {
      setIsOutageTransitioning(false);
    }
  };

  const getSubTabBadge = (tab: string) => {
    const isSelected = activeSubTab === tab;
    return `px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 ${
      isSelected
        ? 'border-slate-900 text-slate-900 dark:border-[#c5a059] dark:text-[#c5a059]'
        : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-[#e0e0e0]'
    }`;
  };

  return (
    <div className="space-y-6">
      {/* Settings / Actions toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded border border-slate-150 bg-white p-4 dark:border-white/5 dark:bg-[#0c0c0c]">
        <div className="space-y-0.5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Operations Control</h4>
          <span className="text-[11px] text-slate-500">Live system performance and resilience tests</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Outage injector button */}
          <button
            type="button"
            onClick={handleOutageToggleClick}
            disabled={isOutageTransitioning}
            className={`flex items-center gap-2 rounded px-3.5 py-1.5 text-xs font-bold border transition-all ${
              isOutageActive
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-500 hover:bg-rose-500/20'
                : 'bg-[#c5a059]/10 border-[#c5a059]/20 text-[#c5a059] hover:bg-[#c5a059]/15'
            }`}
          >
            <AlertOctagon size={13} className={isOutageActive ? 'animate-bounce' : ''} />
            <span>
              {isOutageTransitioning
                ? 'TRANSITIONING...'
                : isOutageActive
                ? 'RESOLVE POSTGRES OUTAGE'
                : 'INJECT POSTGRES OUTAGE'}
            </span>
          </button>

          {/* Refresh Report Button */}
          <button
            type="button"
            onClick={onRefreshReport}
            disabled={isRefreshingReport}
            className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] dark:hover:bg-white/5"
          >
            <RefreshCw size={12} className={isRefreshingReport ? 'animate-spin' : ''} />
            <span>REFRESH METRICS</span>
          </button>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex border-b border-slate-150 dark:border-white/5">
        <button onClick={() => setActiveSubTab('triggers')} className={getSubTabBadge('triggers')}>
          <Activity size={13} />
          <span>Bench Triggers & Resilience</span>
        </button>
        <button onClick={() => setActiveSubTab('latency')} className={getSubTabBadge('latency')}>
          <BarChart4 size={13} />
          <span>Stage Latencies</span>
        </button>
        <button onClick={() => setActiveSubTab('database')} className={getSubTabBadge('database')}>
          <Database size={13} />
          <span>Postgres Storage</span>
        </button>
        <button onClick={() => setActiveSubTab('infra')} className={getSubTabBadge('infra')}>
          <Coins size={13} />
          <span>Docker TCO Costs</span>
        </button>
        <button onClick={() => setActiveSubTab('traceability')} className={getSubTabBadge('traceability')}>
          <ShieldCheck size={13} />
          <span>Token Traceability</span>
        </button>
      </div>

      {/* Subtab Content */}
      <div className="min-h-96">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            {activeSubTab === 'triggers' && (
              <div className="space-y-6">
                {/* Active Jobs Monitor */}
                {activeJobs.length > 0 && (
                  <div className="rounded border border-slate-150 bg-slate-50/50 p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
                    <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Active Jobs Progress</h5>
                    <div className="space-y-4">
                      {activeJobs.map(job => {
                        const pct = Math.floor((job.progress.completed / job.progress.total) * 100) || 0;
                        const isJobRunning = job.status === 'running';

                        return (
                          <div key={job.job_id} className="rounded border border-slate-150 bg-white p-4 dark:border-white/5 dark:bg-[#050505]">
                            <div className="mb-2 flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800 dark:text-[#e0e0e0] capitalize">
                                {job.kind} Validation Job
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">{job.job_id.substring(0, 8)}</span>
                            </div>

                            {/* Progress bar */}
                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-white/5">
                              <div
                                className="h-full rounded-full bg-[#c5a059] transition-all duration-300 dark:bg-[#c5a059]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>

                            <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] text-slate-500">
                              <span>
                                {pct}% Complete ({job.progress.completed.toLocaleString()} / {job.progress.total.toLocaleString()})
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="text-emerald-500 font-bold">{job.progress.successful.toLocaleString()} OK</span>
                                {job.progress.failed > 0 && (
                                  <span className="text-rose-500 font-bold ml-1">{job.progress.failed.toLocaleString()} Err</span>
                                )}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Grid for trigger panels */}
                <div className="grid gap-6 md:grid-cols-3">
                  {/* Pipeline Trigger */}
                  <div className="rounded border border-slate-150 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
                    <h5 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">1. Pipeline Validation</h5>
                    <p className="text-[11px] text-slate-500 mb-4">Validate full 5-agent sequential throughput.</p>

                    <form onSubmit={e => handleTrigger('pipeline', e)} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sample Size</label>
                        <input
                          type="number"
                          value={pipeSize}
                          onChange={e => setPipeSize(Number(e.target.value))}
                          className="w-full rounded border border-slate-200 px-3 py-1.5 font-mono text-xs dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] focus:outline-none focus:border-[#c5a059]/40"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Concurrency Limit</label>
                        <input
                          type="number"
                          value={pipeConcurrency}
                          onChange={e => setPipeConcurrency(Number(e.target.value))}
                          className="w-full rounded border border-slate-200 px-3 py-1.5 font-mono text-xs dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] focus:outline-none focus:border-[#c5a059]/40"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-1.5 rounded bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-[#c5a059] dark:text-[#050505] dark:hover:bg-[#d8b473]"
                      >
                        <Play size={10} className="fill-current" />
                        <span>RUN PIPELINE BENCH</span>
                      </button>
                    </form>
                  </div>

                  {/* Token Generation Trigger */}
                  <div className="rounded border border-slate-150 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
                    <h5 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">2. Token Generator</h5>
                    <p className="text-[11px] text-slate-500 mb-4">Benchmark high-frequency token generation rates.</p>

                    <form onSubmit={e => handleTrigger('tokens', e)} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Tokens</label>
                        <input
                          type="number"
                          value={tokenTotal}
                          onChange={e => setTokenTotal(Number(e.target.value))}
                          className="w-full rounded border border-slate-200 px-3 py-1.5 font-mono text-xs dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] focus:outline-none focus:border-[#c5a059]/40"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Customers</label>
                          <input
                            type="number"
                            value={tokenCustCount}
                            onChange={e => setTokenCustCount(Number(e.target.value))}
                            className="w-full rounded border border-slate-200 px-2.5 py-1.5 font-mono text-xs dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] focus:outline-none focus:border-[#c5a059]/40"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Concurrency</label>
                          <input
                            type="number"
                            value={tokenConcurrency}
                            onChange={e => setTokenConcurrency(Number(e.target.value))}
                            className="w-full rounded border border-slate-200 px-2.5 py-1.5 font-mono text-xs dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] focus:outline-none focus:border-[#c5a059]/40"
                            required
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-1.5 rounded bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-[#c5a059] dark:text-[#050505] dark:hover:bg-[#d8b473]"
                      >
                        <Play size={10} className="fill-current" />
                        <span>RUN TOKEN GENERATOR</span>
                      </button>
                    </form>
                  </div>

                  {/* DB operations trigger */}
                  <div className="rounded border border-slate-150 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
                    <h5 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">3. DB Operations</h5>
                    <p className="text-[11px] text-slate-500 mb-4">Validate write / lookup / update speeds of Postgres.</p>

                    <form onSubmit={e => handleTrigger('db', e)} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sample Operations Size</label>
                        <input
                          type="number"
                          value={dbSampleSize}
                          onChange={e => setDbSampleSize(Number(e.target.value))}
                          className="w-full rounded border border-slate-200 px-3 py-1.5 font-mono text-xs dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] focus:outline-none focus:border-[#c5a059]/40"
                          required
                        />
                      </div>
                      <div className="h-11" /> {/* Spacer */}
                      <button
                        type="submit"
                        className="w-full flex items-center justify-center gap-1.5 rounded bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-[#c5a059] dark:text-[#050505] dark:hover:bg-[#d8b473]"
                      >
                        <Play size={10} className="fill-current" />
                        <span>RUN DB OPERATIONS BENCH</span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'latency' && report?.pipeline && (
              <div className="space-y-5">
                {/* Header overview metrics */}
                <div className="grid gap-4 sm:grid-cols-4">
                  <MetricCard
                    title="Orchestration Rate"
                    value={`${report.pipeline.throughput_tps.value.toFixed(4)} tx/s`}
                    source={report.pipeline.throughput_tps.source}
                    note={report.pipeline.throughput_tps.note}
                  />
                  <MetricCard
                    title="Avg Pipeline Latency"
                    value={`${(report.pipeline.latency.avg_ms / 1000).toFixed(2)}s`}
                    subtext="Total end-to-end trip"
                  />
                  <MetricCard
                    title="Median Pipeline Latency"
                    value={`${(report.pipeline.latency.median_ms / 1000).toFixed(2)}s`}
                    subtext="Typical consensus trip"
                  />
                  <MetricCard
                    title="P99 Pipeline Latency"
                    value={`${(report.pipeline.latency.p99_ms / 1000).toFixed(2)}s`}
                    subtext="Worst-case trip boundary"
                  />
                </div>

                {/* Per-Stage Distributions */}
                <div>
                  <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Microservice Latency Profiles</h5>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <LatencyDistribution metrics={report.pipeline.per_stage_latency_ms.behavioral} label="behavioral (A1)" />
                    <LatencyDistribution metrics={report.pipeline.per_stage_latency_ms.graph} label="graph intelligence (A2)" />
                    <LatencyDistribution metrics={report.pipeline.per_stage_latency_ms.trust} label="trust fusion (A3)" />
                    <LatencyDistribution metrics={report.pipeline.per_stage_latency_ms.compliance} label="regulatory CDD (A4)" />
                    <LatencyDistribution metrics={report.pipeline.per_stage_latency_ms.decision} label="ultimate decision (A5)" />
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'database' && report?.database && (
              <div className="space-y-6">
                {/* DB operation latencies overview */}
                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
                    <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">Registry Insert Speed</span>
                    <span className="font-mono text-xl font-bold text-slate-800 dark:text-[#e0e0e0]">{report.database.insert.latency.avg_ms.toFixed(2)}ms</span>
                  </div>
                  <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
                    <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">Registry Lookup Speed</span>
                    <span className="font-mono text-xl font-bold text-slate-800 dark:text-[#e0e0e0]">{report.database.lookup.latency.avg_ms.toFixed(2)}ms</span>
                  </div>
                  <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
                    <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">Status PATCH Speed</span>
                    <span className="font-mono text-xl font-bold text-slate-800 dark:text-[#e0e0e0]">{report.database.update.latency.avg_ms.toFixed(2)}ms</span>
                  </div>
                  <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
                    <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">Timeline Append Speed</span>
                    <span className="font-mono text-xl font-bold text-slate-800 dark:text-[#e0e0e0]">{report.database.timeline.latency.avg_ms.toFixed(2)}ms</span>
                  </div>
                </div>

                {/* Table Storage Sizes and Rows */}
                {report.infra_cost && (
                  <div>
                    <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">PostgreSQL Table Allocation metrics</h5>
                    <div className="overflow-x-auto rounded border border-slate-150 bg-white dark:border-white/5 dark:bg-[#0c0c0c]/40">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase dark:border-white/5 dark:bg-[#0c0c0c]/80">
                            <th className="p-3">Table Name</th>
                            <th className="p-3">Record Row Count</th>
                            <th className="p-3 text-right">Physical Disk Size (Bytes)</th>
                            <th className="p-3 text-right">Megabytes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-xs text-slate-700 dark:divide-white/5 dark:text-slate-300">
                          {report.infra_cost.table_metrics.map((table, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                              <td className="p-3 font-semibold font-mono">{table.table_name}</td>
                              <td className="p-3 font-bold">{table.row_count.toLocaleString()}</td>
                              <td className="p-3 text-right">{table.size_bytes.toLocaleString()}</td>
                              <td className="p-3 text-right font-bold text-[#c5a059] dark:text-[#c5a059]">
                                {(table.size_bytes / (1024 * 1024)).toFixed(2)} MB
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeSubTab === 'infra' && report?.infra_cost && (
              <div className="space-y-6">
                {/* Total monthly bill card */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <MetricCard
                    title="Estimated Monthly Cloud Bill"
                    value={`$${report.infra_cost.estimated_monthly_cost_usd.value.toFixed(2)}`}
                    source={report.infra_cost.estimated_monthly_cost_usd.source}
                    note={report.infra_cost.estimated_monthly_cost_usd.note}
                    subtext="Aggregated container vCPU, RAM, and Disk storage allocations."
                  />
                  <div className="rounded border border-slate-150 bg-slate-50/50 p-4.5 text-xs text-slate-500 leading-relaxed font-sans dark:border-white/5 dark:bg-[#050505]">
                    <span className="font-bold text-slate-700 block mb-1 dark:text-[#e0e0e0]">Stated Cost Formula Note:</span>
                    {report.infra_cost.cost_formula_note}
                  </div>
                </div>

                {/* 10 containers CPU/RAM load metrics */}
                <div>
                  <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Dockerized Microservice Resource Allocation</h5>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {report.infra_cost.container_stats.map((c, idx) => (
                      <div key={idx} className="rounded border border-slate-150 bg-white p-3.5 dark:border-white/5 dark:bg-[#0c0c0c]">
                        <span className="text-[10px] font-bold text-slate-400 truncate block uppercase font-mono tracking-tight">{c.name.replace('saqrai-', '')}</span>
                        <div className="mt-2 space-y-1 font-mono text-xs">
                          <div className="flex justify-between border-b border-slate-50 pb-0.5 dark:border-white/5">
                            <span className="text-slate-400">CPU:</span>
                            <span className="font-extrabold text-[#c5a059] dark:text-[#c5a059]">{c.cpu_percent.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Memory:</span>
                            <span className="font-bold">{c.mem_usage_mb.toFixed(1)} MB</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Architectural TCO Comparisons table */}
                <div>
                  <h5 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Architectural TCO and Complexity Comparison</h5>
                  <div className="overflow-x-auto rounded border border-slate-150 bg-white dark:border-white/5 dark:bg-[#0c0c0c]/40">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase dark:border-white/5 dark:bg-[#050505]">
                          <th className="p-3 w-40">TCO Axis</th>
                          <th className="p-3">Unified SAQR Architecture</th>
                          <th className="p-3">Traditional Multi-Registry Silos</th>
                          <th className="p-3">Explanation & Technical Fact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs text-slate-700 dark:divide-white/5 dark:text-slate-300">
                        {report.infra_cost.comparison.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                            <td className="p-3 font-bold text-slate-800 dark:text-[#e0e0e0]">{row.label}</td>
                            <td className="p-3 font-medium font-mono text-[#c5a059] dark:text-[#c5a059]">
                              <div className="flex flex-col gap-1 items-start">
                                <span>{row.saqr_value}</span>
                                <SourceBadge source={row.saqr_source} />
                              </div>
                            </td>
                            <td className="p-3 font-mono text-slate-500">
                              <div className="flex flex-col gap-1 items-start">
                                <span>{row.traditional_value}</span>
                                <SourceBadge source={row.traditional_source} />
                              </div>
                            </td>
                            <td className="p-3 text-slate-500 leading-normal">{row.explanation}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'traceability' && report?.traceability && (
              <div className="space-y-6">
                {/* Metrics row */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
                    <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">Checked Tokens</span>
                    <span className="font-mono text-2xl font-bold text-slate-800 dark:text-[#e0e0e0]">{report.traceability.tokens_checked.toLocaleString()}</span>
                  </div>
                  <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
                    <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">Fully Traced Tokens</span>
                    <span className="font-mono text-2xl font-bold text-[#c5a059] dark:text-[#c5a059]">{report.traceability.fully_traced.toLocaleString()}</span>
                  </div>
                  <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
                    <span className="text-[10px] font-semibold text-slate-500 block uppercase tracking-wider">Registry Traceability Ratio</span>
                    <span className="font-mono text-2xl font-bold text-emerald-500">{(report.traceability.success_rate * 100).toFixed(2)}%</span>
                  </div>
                </div>

                {/* Audit completions progress */}
                <div className="rounded border border-slate-150 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
                  <h5 className="mb-4 text-xs font-bold text-slate-700 dark:text-[#e0e0e0] uppercase tracking-wider">Registry Audit Completions ratio</h5>
                  <div className="space-y-3.5">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Agent 1 — Behavioral profile matching completions</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">{report.traceability.behavioral_completed} / {report.traceability.tokens_checked}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#050505]">
                        <div className="h-full rounded-full bg-[#c5a059]" style={{ width: `${(report.traceability.behavioral_completed / report.traceability.tokens_checked) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Agent 2 — Graph relational matching completions</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">{report.traceability.graph_completed} / {report.traceability.tokens_checked}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#050505]">
                        <div className="h-full rounded-full bg-[#c5a059]" style={{ width: `${(report.traceability.graph_completed / report.traceability.tokens_checked) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Agent 3 — Trust evaluation matching completions</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">{report.traceability.trust_completed} / {report.traceability.tokens_checked}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#050505]">
                        <div className="h-full rounded-full bg-[#c5a059]" style={{ width: `${(report.traceability.trust_completed / report.traceability.tokens_checked) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Agent 4 — SAMA policy compliance audit matching completions</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">{report.traceability.compliance_completed} / {report.traceability.tokens_checked}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#050505]">
                        <div className="h-full rounded-full bg-[#c5a059]" style={{ width: `${(report.traceability.compliance_completed / report.traceability.tokens_checked) * 100}%` }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Agent 5 — Fused final decision matching completions</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">{report.traceability.decision_completed} / {report.traceability.tokens_checked}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#050505]">
                        <div className="h-full rounded-full bg-[#c5a059]" style={{ width: `${(report.traceability.decision_completed / report.traceability.tokens_checked) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Empty States if report not fetched/loaded */}
            {!report && (
              <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center dark:border-white/5 dark:bg-[#0c0c0c]">
                <BarChart4 size={24} className="mb-2 text-slate-400" />
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Benchmark Report Not Retrieved</span>
                <p className="mt-1 max-w-xs text-[11px] text-slate-500">
                  Trigger a benchmark above or click "REFRESH METRICS" to pull live measurements from `:8080/api/benchmark/report`.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
