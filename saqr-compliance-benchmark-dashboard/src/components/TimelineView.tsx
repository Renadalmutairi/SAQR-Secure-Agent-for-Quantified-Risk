/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, AlertCircle, Clock } from 'lucide-react';
import { TimelineEvent } from '../types';

interface TimelineViewProps {
  timeline: TimelineEvent[];
  isCompleted?: boolean;
  isFailed?: boolean;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ timeline, isCompleted, isFailed }) => {
  if (timeline.length === 0) {
    return (
      <div className="flex h-32 flex-col items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50 p-4 dark:border-white/5 dark:bg-[#0c0c0c]">
        <Clock size={18} className="mb-1 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500">Timeline Empty</span>
        <p className="mt-0.5 text-[10px] text-slate-400">Mint a token to begin trace stream logging.</p>
      </div>
    );
  }

  // Happy-path timeline strings
  const standardEvents = [
    'Token Created',
    'Behavioral DNA Started',
    'Behavioral DNA Finished',
    'Graph Analysis Started',
    'Graph Analysis Finished',
    'Trust Evaluation Started',
    'Trust Evaluation Finished',
    'Compliance Started',
    'Compliance Finished',
    'Decision Generated'
  ];

  return (
    <div className="rounded border border-slate-150 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
      <div className="mb-4 flex items-center justify-between border-b border-slate-150 pb-3 dark:border-white/5">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Audit Trail Timeline</h4>
          <span className="text-[11px] text-slate-500">Immutable, append-only token registry events</span>
        </div>
        {isCompleted ? (
          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-400/5 dark:text-emerald-400">
            TRACED 10/10
          </span>
        ) : isFailed ? (
          <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-400/5 dark:text-rose-400">
            HALTED ON ERROR
          </span>
        ) : (
          <span className="rounded bg-[#c5a059]/10 px-2 py-0.5 text-[10px] font-bold text-[#c5a059] dark:bg-[#c5a059]/5 dark:text-[#c5a059] animate-pulse">
            STREAMING...
          </span>
        )}
      </div>

      <div className="relative pl-5 before:absolute before:bottom-2 before:left-2.5 before:top-2 before:w-[2px] before:bg-slate-100 dark:before:bg-white/5">
        {timeline.map((item, idx) => {
          const isError = item.event.toLowerCase().includes('failed');
          const isLast = idx === timeline.length - 1;

          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`relative mb-5 flex items-start gap-4 ${isLast ? 'mb-1' : ''}`}
            >
              {/* Timeline marker node */}
              <div className="absolute -left-[19.5px] top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-white dark:bg-[#050505]">
                {isError ? (
                  <AlertCircle size={14} className="text-rose-500 bg-white rounded-full dark:bg-[#050505]" />
                ) : isLast && !isCompleted ? (
                  <Circle size={14} className="text-[#c5a059] dark:text-[#c5a059] fill-[#c5a059]/10 animate-ping" />
                ) : (
                  <CheckCircle2 size={14} className="text-emerald-500 bg-white rounded-full dark:bg-[#050505]" />
                )}
              </div>

              {/* Event Content */}
              <div className="flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-1">
                  <span className={`text-xs font-bold ${isError ? 'text-rose-500' : 'text-slate-800 dark:text-[#e0e0e0]'}`}>
                    {item.event}
                  </span>
                  <span className="font-mono text-[9px] text-slate-400 tabular-nums">
                    {new Date(item.occurred_at).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {item.detail}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
