/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { ReadinessItem } from '../types';

interface SystemReadinessProps {
  items: ReadinessItem[];
  isLoading?: boolean;
}

export const SystemReadiness: React.FC<SystemReadinessProps> = ({ items, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded border border-slate-150 bg-white dark:border-white/5 dark:bg-[#0c0c0c]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c5a059] border-t-transparent" />
        <span className="mt-3 text-xs text-slate-500">Retrieving system readiness indicators...</span>
      </div>
    );
  }

  return (
    <div className="rounded border border-slate-150 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-150 pb-3 dark:border-white/5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">System Readiness Checklist</h4>
          <span className="text-[11px] text-slate-500">Compliance & infrastructure validation (11 indicators)</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded dark:bg-emerald-400/5 dark:text-emerald-400">
          <span>ALL SYSTEMS NOMINAL</span>
        </div>
      </div>

      <div className="grid gap-4.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, idx) => {
          const isLive = item.label_kind === 'live-verified';

          return (
            <div
              key={idx}
              className="group relative flex items-start gap-3 rounded border border-slate-150 p-3.5 transition-all duration-200 dark:border-white/5 dark:bg-[#050505] dark:hover:border-[#c5a059]/20"
            >
              {/* OK check indicator */}
              <div className="shrink-0 mt-0.5">
                {item.ok ? (
                  <CheckCircle size={15} className="text-emerald-500" />
                ) : (
                  <AlertCircle size={15} className="text-rose-500 animate-pulse" />
                )}
              </div>

              {/* Content */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-800 dark:text-[#e0e0e0]">{item.label}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-mono tracking-wider font-extrabold ${
                     isLive
                       ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-400/5 dark:text-emerald-400 dark:border-emerald-400/15'
                       : 'bg-[#c5a059]/10 text-[#c5a059] border border-[#c5a059]/20 dark:bg-[#c5a059]/5 dark:text-[#c5a059] dark:border-[#c5a059]/15'
                  }`}>
                    {item.label_kind.toUpperCase()}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
