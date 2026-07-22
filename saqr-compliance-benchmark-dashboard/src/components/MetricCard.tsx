/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle } from 'lucide-react';

interface MetricCardProps {
  id?: string;
  title: string;
  value: string | number;
  source?: 'measured' | 'projected' | 'estimated';
  note?: string | null;
  subtext?: string | React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const SourceBadge: React.FC<{ source: 'measured' | 'projected' | 'estimated'; note?: string | null }> = ({ source, note }) => {
  const getColors = () => {
    switch (source) {
      case 'measured':
        return {
          bg: 'bg-emerald-500/10 dark:bg-emerald-400/5',
          text: 'text-emerald-600 dark:text-emerald-400',
          border: 'border-emerald-500/20 dark:border-emerald-400/15',
          label: 'MEASURED'
        };
      case 'projected':
        return {
          bg: 'bg-amber-500/10 dark:bg-amber-400/5',
          text: 'text-amber-600 dark:text-amber-400',
          border: 'border-amber-500/20 dark:border-amber-400/15',
          label: 'PROJECTED'
        };
      case 'estimated':
        return {
          bg: 'bg-[#c5a059]/10 dark:bg-[#c5a059]/5',
          text: 'text-[#c5a059] dark:text-[#c5a059]',
          border: 'border-[#c5a059]/20 dark:border-[#c5a059]/15',
          label: 'ESTIMATED'
        };
    }
  };

  const { bg, text, border, label } = getColors();

  return (
    <div className={`group relative inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono tracking-wider font-semibold ${bg} ${text} ${border}`}>
      <span>{label}</span>
      {note && (
        <div className="relative cursor-help">
          <HelpCircle size={10} className="opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-48 p-2 bg-slate-900 text-slate-100 text-[10px] leading-relaxed font-sans font-normal rounded shadow-xl border border-slate-700 z-50">
            {note}
          </div>
        </div>
      )}
    </div>
  );
};

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  source,
  note,
  subtext,
  icon,
  className = ''
}) => {
  return (
    <div
      id={id}
      className={`relative overflow-hidden rounded border border-slate-150 bg-white p-5 transition-all duration-200 dark:border-white/5 dark:bg-[#0c0c0c] dark:hover:border-[#c5a059]/30 ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</span>
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-[#e0e0e0] tabular-nums">
              {value}
            </span>
            {source && <SourceBadge source={source} note={note} />}
          </div>
        </div>
        {icon && (
          <div className="rounded bg-slate-50 p-2 text-slate-500 dark:bg-[#050505] dark:border dark:border-white/5 dark:text-slate-400">
            {icon}
          </div>
        )}
      </div>
      {subtext && (
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {subtext}
        </div>
      )}
    </div>
  );
};
