/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, HelpCircle, Terminal as TerminalIcon, ShieldAlert, Zap, History, Database, Layers } from 'lucide-react';
import { TransactionInput } from '../types';

interface InteractiveFormProps {
  onRun: (input: TransactionInput) => Promise<any>;
  isRunning: boolean;
  isDbOnline: boolean;
  historyTokens: string[];
  activeToken: string | null;
  onSelectToken: (token: string) => void;
  logs: string[];
}

export const InteractiveForm: React.FC<InteractiveFormProps> = ({
  onRun,
  isRunning,
  isDbOnline,
  historyTokens,
  activeToken,
  onSelectToken,
  logs
}) => {
  const [accountId, setAccountId] = useState('959');
  const [receiverId, setReceiverId] = useState('450');
  const [amount, setAmount] = useState<number>(250.00);
  const [txType, setTxType] = useState('TRANSFER');

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRunning) return;
    onRun({
      account_id: accountId,
      receiver_account_id: receiverId,
      amount,
      tx_type: txType
    });
  };

  const applyPreset = (preset: 'normal' | 'review' | 'reject') => {
    if (isRunning) return;
    if (preset === 'normal') {
      setAccountId('959');
      setReceiverId('450');
      setAmount(250.00);
      setTxType('TRANSFER');
    } else if (preset === 'review') {
      setAccountId('982');
      setReceiverId('115');
      setAmount(15400.00);
      setTxType('TRANSFER');
    } else if (preset === 'reject') {
      setAccountId('773');
      setReceiverId('819');
      setAmount(120000.00);
      setTxType('TRANSFER');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Parameters Panel */}
      <div className="rounded border border-slate-100 bg-white p-5 lg:col-span-5 dark:border-white/5 dark:bg-[#0c0c0c]">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">Orchestration Parameters</h4>
        <p className="text-[11px] text-slate-500 mb-4">Select quick-presets or customize individual transaction fields.</p>

        {/* Quick presets buttons */}
        <div className="mb-4 flex flex-wrap gap-1.5 border-b border-slate-50 pb-3.5 dark:border-white/5">
          <button
            type="button"
            onClick={() => applyPreset('normal')}
            disabled={isRunning}
            className="flex items-center gap-1 rounded bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 hover:bg-emerald-500/15 disabled:opacity-50 dark:bg-emerald-500/5 dark:text-[#4ade80] dark:border dark:border-emerald-500/10"
          >
            <Zap size={10} />
            <span>Low-Risk (APPROVE)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('review')}
            disabled={isRunning}
            className="flex items-center gap-1 rounded bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold text-amber-600 hover:bg-amber-500/15 disabled:opacity-50 dark:bg-amber-500/5 dark:text-amber-400 dark:border dark:border-amber-500/10"
          >
            <HelpCircle size={10} />
            <span>Mid-Risk (REVIEW)</span>
          </button>
          <button
            type="button"
            onClick={() => applyPreset('reject')}
            disabled={isRunning}
            className="flex items-center gap-1 rounded bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-500/15 disabled:opacity-50 dark:bg-rose-500/5 dark:text-rose-400 dark:border dark:border-rose-500/10"
          >
            <ShieldAlert size={10} />
            <span>High-Risk (REJECT)</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Sender Account ID</label>
              <input
                type="text"
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                disabled={isRunning}
                className="w-full rounded border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] focus:outline-none dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] dark:focus:border-[#c5a059]"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Receiver Account ID</label>
              <input
                type="text"
                value={receiverId}
                onChange={e => setReceiverId(e.target.value)}
                disabled={isRunning}
                className="w-full rounded border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] focus:outline-none dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] dark:focus:border-[#c5a059]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Amount (SAR)</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                disabled={isRunning}
                className="w-full rounded border border-slate-200 px-3 py-1.5 font-mono text-xs focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] focus:outline-none dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0] dark:focus:border-[#c5a059]"
                min="0.01"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Transaction Type</label>
              <select
                value={txType}
                onChange={e => setTxType(e.target.value)}
                disabled={isRunning}
                className="w-full rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold focus:border-[#c5a059] focus:outline-none dark:border-white/5 dark:bg-[#050505] dark:text-[#e0e0e0]"
              >
                <option value="TRANSFER">TRANSFER (SAMA)</option>
                <option value="WIRE">WIRE CROSS-BORDER</option>
                <option value="DEPOSIT">DEPOSIT</option>
                <option value="WITHDRAWAL">WITHDRAWAL</option>
              </select>
            </div>
          </div>

          {/* database online gate button */}
          <button
            type="submit"
            disabled={isRunning || !isDbOnline}
            className={`w-full flex items-center justify-center gap-2 rounded py-3 text-xs font-bold tracking-widest uppercase transition-all ${
              !isDbOnline
                ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed dark:bg-slate-900/50 dark:border-white/5 dark:text-slate-600'
                : isRunning
                ? 'bg-[#c5a059]/20 border border-transparent text-[#c5a059] cursor-wait animate-pulse'
                : 'bg-slate-900 border border-transparent text-white hover:bg-slate-800 dark:bg-[#c5a059] dark:text-black dark:hover:bg-[#b48e47]'
            }`}
          >
            {isRunning ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                <span>EVALUATING IN CO-ORDINATION...</span>
              </>
            ) : (
              <>
                <Play size={11} className="fill-current" />
                <span>MINT SAQR TOKEN & RUN</span>
              </>
            )}
          </button>
          {!isDbOnline && (
            <p className="text-[10px] font-semibold text-rose-500 text-center flex items-center justify-center gap-1">
              <ShieldAlert size={10} />
              DATABASE OFFLINE — Run restricted until Postgres recovery completes.
            </p>
          )}
        </form>
      </div>

      {/* Terminal logs panel */}
      <div className="rounded border border-slate-150 bg-slate-950 p-4 font-mono lg:col-span-4 dark:border-white/5 dark:bg-[#080808]">
        <div className="mb-2 flex items-center justify-between border-b border-slate-900 pb-1.5">
          <div className="flex items-center gap-1.5 text-slate-400">
            <TerminalIcon size={12} className="text-[#c5a059] dark:text-[#c5a059]" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Kafka & Worker Telemetry</span>
          </div>
          <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[8px] font-bold text-[#c5a059] dark:text-[#c5a059] animate-pulse">
            LIVE
          </span>
        </div>

        <div className="h-44 overflow-y-auto space-y-1.5 pr-1.5 text-[10px] leading-relaxed text-slate-300">
          {logs.map((log, idx) => (
            <div key={idx} className="border-l-2 border-slate-800 pl-1.5">
              <span className="text-[#c5a059] dark:text-[#c5a059]">&rsaquo;</span> {log}
            </div>
          ))}
          {logs.length === 0 && (
            <div className="flex h-32 items-center justify-center text-slate-600 text-center font-sans text-[11px]">
              Ready to stream...
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Token History Panel */}
      <div className="rounded border border-slate-100 bg-white p-5 lg:col-span-3 dark:border-white/5 dark:bg-[#0c0c0c]">
        <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1.5">Token Ledger</h4>
        <p className="text-[11px] text-slate-500 mb-3">Retrieved from registry.</p>

        <div className="h-44 overflow-y-auto space-y-1 pr-1.5">
          {historyTokens.map((t, idx) => {
            const isActive = activeToken === t;
            return (
              <button
                key={t}
                onClick={() => onSelectToken(t)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded border text-left text-xs font-mono transition-all ${
                  isActive
                    ? 'bg-[#c5a059]/10 border-[#c5a059] text-[#c5a059] dark:bg-[#c5a059]/5 dark:border-[#c5a059] dark:text-[#c5a059]'
                    : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 text-slate-600 hover:text-slate-900 dark:bg-[#050505] dark:border-white/5 dark:text-white/40 dark:hover:bg-[#0c0c0c] dark:hover:text-[#e0e0e0]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Layers size={10} className="opacity-70" />
                  <span className="font-bold">{t.replace('SAQR-TX-', '')}</span>
                </div>
                <span className="text-[9px] text-slate-400">View</span>
              </button>
            );
          })}
          {historyTokens.length === 0 && (
            <div className="flex h-32 flex-col items-center justify-center text-center font-sans text-slate-400">
              <History size={16} className="mb-1 opacity-50" />
              <span className="text-[10px] font-semibold">Ledger Empty</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
