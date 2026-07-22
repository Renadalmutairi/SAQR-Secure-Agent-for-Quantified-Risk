/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LatencyMetrics } from '../types';

interface LatencyDistributionProps {
  metrics: LatencyMetrics | null;
  label: string;
}

export const LatencyDistribution: React.FC<LatencyDistributionProps> = ({ metrics, label }) => {
  if (!metrics) {
    return (
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-center dark:border-slate-800/40 dark:bg-slate-900/10">
        <span className="text-xs text-slate-400">No Latency Profile Available</span>
      </div>
    );
  }

  const { min_ms, median_ms, avg_ms, p95_ms, p99_ms, max_ms, count } = metrics;

  // Let's normalize positions relative to max_ms to draw an absolute visual range
  // We can use a logarithmic scale or linear scale with capped max. Let's use a soft logarithmic or linear scale with a safe min/max.
  // Linear scale is very direct:
  const getPct = (val: number) => {
    if (max_ms === min_ms) return 50;
    const pct = ((val - min_ms) / (max_ms - min_ms)) * 100;
    return Math.max(2, Math.min(98, pct));
  };

  const avgPct = getPct(avg_ms);
  const medianPct = getPct(median_ms);
  const p95Pct = getPct(p95_ms);
  const p99Pct = getPct(p99_ms);

  return (
    <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#0c0c0c]">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">{label} Engine</span>
          <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] text-slate-500 dark:bg-slate-800/80 dark:text-slate-400">
            N={count.toLocaleString()}
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-400">
          Avg: <span className="font-semibold text-slate-700 dark:text-slate-300">{avg_ms.toFixed(1)}ms</span>
        </div>
      </div>

      {/* Latency envelope bar */}
      <div className="relative my-6 h-3.5 rounded bg-slate-100 dark:bg-[#050505]">
        {/* Shaded zone between min and p95 */}
        <div 
          className="absolute h-full rounded bg-gradient-to-r from-[#c5a059]/15 to-[#c5a059]/5" 
          style={{ left: '0%', width: `${p95Pct}%` }}
        />
        {/* Shaded warning zone between p95 and max */}
        <div 
          className="absolute h-full rounded bg-gradient-to-r from-amber-500/5 to-rose-500/10" 
          style={{ left: `${p95Pct}%`, width: `${100 - p95Pct}%` }}
        />

        {/* Min Marker */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" title={`Min: ${min_ms.toFixed(1)}ms`} />

        {/* Median Marker (Gold) */}
        <div 
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-[#c5a059]" 
          style={{ left: `${medianPct}%` }}
          title={`Median: ${median_ms.toFixed(1)}ms`}
        />

        {/* Avg Marker (Dashed Ring) */}
        <div 
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-slate-600 bg-white dark:border-slate-300 dark:bg-slate-950" 
          style={{ left: `${avgPct}%` }}
          title={`Average: ${avg_ms.toFixed(1)}ms`}
        />

        {/* P95 Marker (Amber) */}
        <div 
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-amber-500" 
          style={{ left: `${p95Pct}%` }}
          title={`P95: ${p95_ms.toFixed(1)}ms`}
        />

        {/* P99 Marker (Rose) */}
        <div 
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded bg-rose-500" 
          style={{ left: `${p99Pct}%` }}
          title={`P99: ${p99_ms.toFixed(1)}ms`}
        />

        {/* Max Marker */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-rose-600" title={`Max: ${max_ms.toFixed(1)}ms`} />
      </div>

      {/* Grid values */}
      <div className="grid grid-cols-6 gap-1 border-t border-slate-150 pt-2.5 dark:border-white/5">
        <div className="text-center">
          <div className="text-[9px] font-medium text-slate-400">Min</div>
          <div className="font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400">{min_ms.toFixed(1)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] font-medium text-slate-400">Median</div>
          <div className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300">{median_ms.toFixed(1)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] font-medium text-slate-400">Avg</div>
          <div className="font-mono text-[10px] font-bold text-slate-800 dark:text-[#c5a059]">{avg_ms.toFixed(1)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] font-medium text-slate-400 text-amber-500">P95</div>
          <div className="font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">{p95_ms.toFixed(1)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] font-medium text-rose-500">P99</div>
          <div className="font-mono text-[10px] font-bold text-rose-600 dark:text-rose-400">{p99_ms.toFixed(1)}</div>
        </div>
        <div className="text-center">
          <div className="text-[9px] font-medium text-rose-600">Max</div>
          <div className="font-mono text-[10px] font-bold text-rose-700 dark:text-rose-500">{max_ms.toFixed(1)}</div>
        </div>
      </div>
    </div>
  );
};
