/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Brain,
  Network,
  ShieldCheck,
  FileCheck2,
  AlertTriangle,
  Award,
  TrendingUp,
  AlertOctagon,
  CornerDownRight,
  UserCheck,
  Check,
  X,
  HelpCircle
} from 'lucide-react';
import {
  StageName,
  StageResult,
  BehavioralDnaResult,
  GraphIntelligenceResult,
  TrustIntelligenceResult,
  ComplianceIntelligenceResult,
  DecisionIntelligenceResult
} from '../types';

interface StageResultViewProps {
  stages: StageResult[];
  activeStageTab?: StageName;
  onTabChange?: (tab: StageName) => void;
}

export const StageResultView: React.FC<StageResultViewProps> = ({
  stages,
  activeStageTab,
  onTabChange
}) => {
  const [localActiveTab, setLocalActiveTab] = useState<StageName>('behavioral');
  const activeTab = activeStageTab || localActiveTab;
  const setActiveTab = onTabChange || setLocalActiveTab;

  const currentStageResult = stages.find(s => s.stage === activeTab);

  const tabs: { name: StageName; label: string; icon: React.ReactNode }[] = [
    { name: 'behavioral', label: '1. Behavioral DNA', icon: <Brain size={14} /> },
    { name: 'graph', label: '2. Graph Intelligence', icon: <Network size={14} /> },
    { name: 'trust', label: '3. Trust Fusion', icon: <ShieldCheck size={14} /> },
    { name: 'compliance', label: '4. Regulatory CDD', icon: <FileCheck2 size={14} /> },
    { name: 'decision', label: '5. Fused Decision', icon: <Award size={14} /> }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:bg-emerald-500/5 dark:text-[#4ade80] border dark:border-emerald-500/10">
            COMPLETED
          </span>
        );
      case 'running':
        return (
          <span className="rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:bg-blue-500/5 dark:text-blue-400 border dark:border-blue-500/10 animate-pulse">
            EVALUATING...
          </span>
        );
      case 'failed':
        return (
          <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:bg-rose-500/5 dark:text-rose-400 border dark:border-rose-500/10">
            CRITICAL FAILURE
          </span>
        );
      default:
        return (
          <span className="rounded bg-slate-150 px-2 py-0.5 text-[10px] font-bold text-slate-400 dark:bg-[#050505] dark:border dark:border-white/5 dark:text-white/30">
            PENDING
          </span>
        );
    }
  };

  const renderBehavioral = (data: BehavioralDnaResult) => {
    return (
      <div className="space-y-5">
        {/* Core summary metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DNA Risk Score</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-lg font-extrabold text-slate-800 dark:text-[#e0e0e0]">
                {data.behavioral_risk_score.toFixed(4)}
              </span>
              <span className={`text-[10px] font-bold ${data.behavioral_risk_score > 0.5 ? 'text-rose-500' : 'text-[#c5a059]'}`}>
                {data.behavioral_risk_score > 0.5 ? 'HIGH' : 'LOW'}
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Similarity Score</span>
            <div className="mt-1">
              <span className="font-mono text-lg font-extrabold text-slate-800 dark:text-[#e0e0e0]">
                {(data.similarity_score * 100).toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Profile Depth</span>
            <div className="mt-1">
              <span className="font-mono text-lg font-extrabold text-[#c5a059] dark:text-[#c5a059]">
                v{data.profile_version}
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audit Token</span>
            <div className="mt-1">
              <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {data.saqr_token}
              </span>
            </div>
          </div>
        </div>

        {/* Narrative Description */}
        <div className="rounded border border-slate-150 bg-white p-4 dark:border-white/5 dark:bg-[#050505]">
          <h5 className="text-xs font-bold text-slate-700 dark:text-[#e0e0e0] flex items-center gap-1.5 mb-1.5">
            <TrendingUp size={13} className="text-[#c5a059]" />
            Statistical Explanation
          </h5>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
            {data.explanation}
          </p>
        </div>

        {/* Changed features tables */}
        {data.changed_features && data.changed_features.length > 0 && (
          <div>
            <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Observed Baselines & Anomalies</h5>
            <div className="overflow-x-auto rounded border border-slate-150 bg-white dark:border-white/5 dark:bg-[#050505]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase dark:border-white/5 dark:bg-[#050505]/80">
                    <th className="p-3">Feature</th>
                    <th className="p-3">Group</th>
                    <th className="p-3">Baseline Mean</th>
                    <th className="p-3">Observed</th>
                    <th className="p-3">Z-Score</th>
                    <th className="p-3 text-right">Deviation Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs text-slate-700 dark:divide-[#1a1a1a] dark:text-slate-300">
                  {data.changed_features.map((feat, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      <td className="p-3 font-semibold">{feat.feature}</td>
                      <td className="p-3 text-slate-400 capitalize">{feat.group}</td>
                      <td className="p-3">{feat.baseline_mean.toFixed(2)} &plusmn; {feat.baseline_stddev.toFixed(2)}</td>
                      <td className="p-3 font-bold">{feat.observed.toFixed(2)}</td>
                      <td className={`p-3 font-bold ${Math.abs(feat.z_score) > 1.5 ? 'text-rose-500' : 'text-[#c5a059]'}`}>
                        {feat.z_score > 0 ? `+${feat.z_score.toFixed(3)}` : feat.z_score.toFixed(3)}
                      </td>
                      <td className="p-3 text-right">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                          feat.deviation_level === 'high' || feat.deviation_level === 'critical'
                            ? 'bg-rose-500/10 text-rose-500'
                            : feat.deviation_level === 'moderate'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-emerald-500/10 text-emerald-500'
                        }`}>
                          {feat.deviation_level}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Feature DNA Vector */}
        <div>
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Behavioral DNA Profile Vector ({data.behavioral_dna_vector.length} keys)</h5>
          <div className="overflow-x-auto rounded border border-slate-150 bg-white dark:border-white/5 dark:bg-[#050505]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase dark:border-white/5 dark:bg-[#050505]/80">
                  <th className="p-3">Feature Name</th>
                  <th className="p-3">Group</th>
                  <th className="p-3">Profile Size</th>
                  <th className="p-3">Running Mean</th>
                  <th className="p-3">Running Variance</th>
                  <th className="p-3 text-right">Running Stddev</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs text-slate-700 dark:divide-[#1a1a1a] dark:text-slate-300">
                {data.behavioral_dna_vector.map((vec, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                    <td className="p-3 font-semibold">{vec.feature}</td>
                    <td className="p-3 text-slate-400 capitalize">{vec.group}</td>
                    <td className="p-3">{vec.count}</td>
                    <td className="p-3">{vec.mean.toFixed(4)}</td>
                    <td className="p-3">{vec.variance.toFixed(4)}</td>
                    <td className="p-3 text-right text-[#c5a059] dark:text-[#c5a059]">{vec.stddev.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderGraph = (data: GraphIntelligenceResult) => {
    const isAnomaly = data.structural_anomalies && data.structural_anomalies.length > 0;
    return (
      <div className="space-y-5">
        {/* Graph analytics features */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">PageRank Score</span>
            <div className="mt-1">
              <span className="font-mono text-lg font-extrabold text-slate-800 dark:text-[#e0e0e0]">
                {data.structural_features.pagerank.toFixed(4)}
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Betweenness Centrality</span>
            <div className="mt-1">
              <span className="font-mono text-lg font-extrabold text-slate-800 dark:text-[#e0e0e0]">
                {data.structural_features.betweenness.toFixed(4)}
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Community Membership</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-lg font-extrabold text-[#c5a059] dark:text-[#c5a059]">
                C-{data.community_id}
              </span>
              <span className="text-[10px] font-mono text-slate-400 dark:text-white/40">
                (Size: {data.community_size})
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GDS Structural Score</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-lg font-extrabold text-slate-800 dark:text-[#e0e0e0]">
                {data.structural_features.structural_complexity_score.toFixed(4)}
              </span>
              <span className={`text-[10px] font-bold ${data.structural_features.structural_complexity_score > 0.5 ? 'text-rose-500' : 'text-[#c5a059]'}`}>
                {data.structural_features.structural_complexity_score > 0.5 ? 'COMPLEX' : 'STABLE'}
              </span>
            </div>
          </div>
        </div>

        {/* Structural Anomalies alert panel */}
        {isAnomaly && (
          <div className="rounded border border-rose-100 bg-rose-500/5 p-4 dark:border-rose-950/20">
            <div className="flex gap-2.5">
              <AlertOctagon className="text-rose-500 shrink-0" size={16} />
              <div>
                <h5 className="text-xs font-bold text-rose-600 dark:text-rose-400">Structural Anomaly Flagged by Agent 2</h5>
                <ul className="mt-1 text-[11px] text-rose-500 space-y-0.5 list-disc pl-4 leading-relaxed font-mono">
                  {data.structural_anomalies.map((anom, i) => (
                    <li key={i}>{anom}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Full structural metrics details */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
            <h5 className="mb-3 text-xs font-bold text-slate-700 dark:text-[#e0e0e0] uppercase tracking-wider">Network Degree Properties</h5>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-50 pb-1.5 dark:border-[#1a1a1a]">
                <span className="text-slate-400">Active Degrees (in + out):</span>
                <span className="font-bold text-slate-800 dark:text-[#e0e0e0]">{data.structural_features.degree}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-1.5 dark:border-[#1a1a1a]">
                <span className="text-slate-400">Weighted Relationship Volume:</span>
                <span className="font-bold text-slate-800 dark:text-[#e0e0e0]">{data.structural_features.weighted_degree.toLocaleString()} SAR</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-1.5 dark:border-[#1a1a1a]">
                <span className="text-slate-400">Indegree (Fan-In Count):</span>
                <span className="font-bold text-slate-800 dark:text-[#e0e0e0]">{data.structural_features.fan_in}</span>
              </div>
              <div className="flex justify-between pb-1.5">
                <span className="text-slate-400">Outdegree (Fan-Out Count):</span>
                <span className="font-bold text-slate-800 dark:text-[#e0e0e0]">{data.structural_features.fan_out}</span>
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
            <h5 className="mb-3 text-xs font-bold text-slate-700 dark:text-[#e0e0e0] uppercase tracking-wider">GDS Centrality &amp; Clusters</h5>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between border-b border-slate-50 pb-1.5 dark:border-[#1a1a1a]">
                <span className="text-slate-400">Eigenvector Centrality:</span>
                <span className="font-bold text-slate-800 dark:text-[#e0e0e0]">{data.structural_features.eigenvector.toFixed(5)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-1.5 dark:border-[#1a1a1a]">
                <span className="text-slate-400">Clustering Coefficient:</span>
                <span className="font-bold text-slate-800 dark:text-[#e0e0e0]">{data.structural_features.clustering_coefficient.toFixed(4)}</span>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-1.5 dark:border-[#1a1a1a]">
                <span className="text-slate-400">Shared Beneficiaries Cluster:</span>
                <span className="font-bold text-slate-800 dark:text-[#e0e0e0]">{data.structural_features.shared_beneficiary_count} shared</span>
              </div>
              <div className="flex justify-between pb-1.5">
                <span className="text-slate-400">Neo4j Confidence Rating:</span>
                <span className="font-bold text-slate-800 dark:text-[#e0e0e0]">{(data.graph_confidence_score * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Embedding vector list */}
        <div>
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Graph Embedding (Node2Vec dimensions, 128 floats)</h5>
          <div className="rounded border border-slate-150 bg-slate-50 p-3 dark:border-white/5 dark:bg-[#050505]">
            <p className="font-mono text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed break-all">
              [{data.graph_embedding.slice(0, 15).join(', ')}, ..., {data.graph_embedding.slice(-5).join(', ')}]
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderTrust = (data: TrustIntelligenceResult) => {
    return (
      <div className="space-y-5">
        {/* Core Trust Rating */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded border border-slate-150 bg-slate-50/40 p-4 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fusion Trust Score</span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-[#c5a059] dark:text-[#c5a059]">
                {data.trust_score.toFixed(4)}
              </span>
              <span className={`text-xs font-bold ${data.trust_score >= 0.7 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {data.trust_score >= 0.7 ? 'TRUSTED' : 'UNSECURE'}
              </span>
            </div>
            {/* Visual metric slide */}
            <div className="mt-3.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#1a1a1a]">
              <div 
                className="h-full rounded-full bg-[#c5a059]" 
                style={{ width: `${data.trust_score * 100}%` }}
              />
            </div>
          </div>

          <div className="rounded border border-slate-150 bg-slate-50/40 p-4 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fuzzy Confidence Level</span>
            <div className="mt-1">
              <span className="font-mono text-3xl font-extrabold text-slate-800 dark:text-[#e0e0e0]">
                {(data.confidence_level * 100).toFixed(0)}%
              </span>
            </div>
            {/* Visual metric slide */}
            <div className="mt-3.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-[#1a1a1a]">
              <div 
                className="h-full rounded-full bg-slate-500 dark:bg-white/20" 
                style={{ width: `${data.confidence_level * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Narrative Description */}
        <div className="rounded border border-slate-150 bg-white p-4 dark:border-white/5 dark:bg-[#050505]">
          <h5 className="text-xs font-bold text-slate-700 dark:text-[#e0e0e0] flex items-center gap-1.5 mb-1.5">
            <ShieldCheck size={13} className="text-[#c5a059]" />
            Evidence Synthesis Narrative
          </h5>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
            {data.explanation}
          </p>
        </div>

        {/* Dominant Factors */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-3.5 dark:border-emerald-500/10">
            <h6 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider dark:text-[#4ade80] mb-1.5">Dominant Positive Enablers</h6>
            {data.dominant_positive_factors.length > 0 ? (
              <ul className="text-xs space-y-1">
                {data.dominant_positive_factors.map((fact, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Check size={11} className="text-emerald-500" />
                    <span className="font-mono">{fact}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-slate-400 italic">None logged</span>
            )}
          </div>

          <div className="rounded border border-rose-500/20 bg-rose-500/5 p-3.5 dark:border-rose-500/10">
            <h6 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider dark:text-rose-400 mb-1.5">Dominant Negative Inhibitors</h6>
            {data.dominant_negative_factors.length > 0 ? (
              <ul className="text-xs space-y-1">
                {data.dominant_negative_factors.map((fact, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <X size={11} className="text-rose-500" />
                    <span className="font-mono">{fact}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-slate-400 italic">No negative inhibitors recorded</span>
            )}
          </div>
        </div>

        {/* Missing evidence list */}
        {data.missing_evidence && data.missing_evidence.length > 0 && (
          <div className="rounded border border-slate-150 bg-slate-50/50 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Excluded Evidence channels (not treated as neutral)</h6>
            <div className="flex flex-wrap gap-1.5">
              {data.missing_evidence.map((miss, i) => (
                <span key={i} className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[9px] text-slate-600 dark:bg-[#1a1a1a] dark:text-slate-400">
                  {miss}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trust Evidence Matrix */}
        <div>
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Evidence Fusion matrix</h5>
          <div className="overflow-x-auto rounded border border-slate-150 bg-white dark:border-white/5 dark:bg-[#050505]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase dark:border-white/5 dark:bg-[#050505]/80">
                  <th className="p-3">Source Channel</th>
                  <th className="p-3">Presence</th>
                  <th className="p-3">Raw Score</th>
                  <th className="p-3">Confidence</th>
                  <th className="p-3">Quality Index</th>
                  <th className="p-3">Weight</th>
                  <th className="p-3 text-right">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs text-slate-700 dark:divide-[#1a1a1a] dark:text-slate-300">
                {data.evidence_breakdown.map((ev, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                    <td className="p-3 font-semibold capitalize">{ev.source.replace('_', ' ')}</td>
                    <td className="p-3">
                      {ev.available ? (
                        <span className="text-emerald-500 font-bold font-mono">OK</span>
                      ) : (
                        <span className="text-slate-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="p-3">{ev.score !== null ? ev.score.toFixed(4) : '—'}</td>
                    <td className="p-3">{ev.confidence !== null ? ev.confidence.toFixed(2) : '—'}</td>
                    <td className="p-3">{ev.quality !== null ? ev.quality.toFixed(2) : '—'}</td>
                    <td className="p-3">{(ev.weight * 100).toFixed(0)}%</td>
                    <td className="p-3 text-right font-bold text-[#c5a059] dark:text-[#c5a059]">
                      {ev.contribution !== null ? ev.contribution.toFixed(4) : '0.0000'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderCompliance = (data: ComplianceIntelligenceResult) => {
    return (
      <div className="space-y-5">
        {/* Compliance details */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Compliance Status</span>
            <div className="mt-1">
              <span className={`font-mono text-lg font-extrabold ${
                data.compliance_status === 'compliant' ? 'text-emerald-500' : 'text-amber-500'
              } uppercase`}>
                {data.compliance_status}
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Automated Score</span>
            <div className="mt-1">
              <span className="font-mono text-lg font-extrabold text-slate-800 dark:text-[#e0e0e0]">
                {(data.compliance_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Agent confidence</span>
            <div className="mt-1">
              <span className="font-mono text-lg font-extrabold text-slate-800 dark:text-[#e0e0e0]">
                {(data.compliance_confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="rounded border border-slate-150 bg-slate-50/40 p-3.5 dark:border-white/5 dark:bg-[#050505]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Loaded Rules</span>
            <div className="mt-1">
              <span className="font-mono text-lg font-extrabold text-[#c5a059] dark:text-[#c5a059]">
                29 rules
              </span>
            </div>
          </div>
        </div>

        {/* Explanation array lines */}
        <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
          <h5 className="mb-2 text-xs font-bold text-slate-700 dark:text-[#e0e0e0] uppercase tracking-wider flex items-center gap-1.5">
            <FileCheck2 size={13} className="text-[#c5a059]" />
            SAMA Policy Assessment Breakdown
          </h5>
          <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
            {data.compliance_explanation.map((line, idx) => (
              <li key={idx} className="flex gap-2.5 items-start">
                <CornerDownRight size={12} className="text-slate-400 shrink-0 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Assessment metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded border border-slate-150 bg-white p-4 dark:border-white/5 dark:bg-[#050505]">
            <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">AML &amp; Sanctions Check</h6>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Rules Passed:</span><span className="text-emerald-500 font-bold">{data.aml_assessment.passed}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Rules Violated:</span><span className={data.aml_assessment.violated > 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}>{data.aml_assessment.violated}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Unevaluated:</span><span className="dark:text-white/40">{data.aml_assessment.unevaluated}</span></div>
            </div>
          </div>

          <div className="rounded border border-slate-150 bg-white p-4 dark:border-white/5 dark:bg-[#050505]">
            <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">KYC &amp; CDD Profiling</h6>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Rules Passed:</span><span className="text-emerald-500 font-bold">{data.kyc_assessment.passed}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Rules Violated:</span><span className={data.kyc_assessment.violated > 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}>{data.kyc_assessment.violated}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Unevaluated:</span><span className="dark:text-white/40">{data.kyc_assessment.unevaluated}</span></div>
            </div>
          </div>

          <div className="rounded border border-slate-150 bg-white p-4 dark:border-white/5 dark:bg-[#050505]">
            <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Internal Governance Policy</h6>
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between"><span className="text-slate-400">Rules Passed:</span><span className="text-emerald-500 font-bold">{data.policy_assessment.passed}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Rules Violated:</span><span className={data.policy_assessment.violated > 0 ? 'text-rose-500 font-bold' : 'text-slate-400'}>{data.policy_assessment.violated}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Unevaluated:</span><span className="dark:text-white/40">{data.policy_assessment.unevaluated}</span></div>
            </div>
          </div>
        </div>

        {/* Rules details list */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-slate-150 bg-white p-4 dark:border-white/5 dark:bg-[#050505]">
            <h6 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-2 dark:text-[#4ade80]">Passed SAMA Rules</h6>
            <div className="flex flex-wrap gap-1.5">
              {data.passed_rules.map((rule, idx) => (
                <span key={idx} className="rounded bg-emerald-500/5 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-[#4ade80] dark:bg-[#10b981]/5 border dark:border-[#10b981]/10">
                  {rule}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded border border-slate-150 bg-white p-4 dark:border-white/5 dark:bg-[#050505]">
            <h6 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-2 dark:text-rose-400">Violated SAMA Rules</h6>
            {data.violated_rules.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.violated_rules.map((rule, idx) => (
                  <span key={idx} className="rounded bg-rose-500/5 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-600 dark:text-rose-400 dark:bg-rose-500/5 border dark:border-rose-500/10">
                    {rule}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">No rules violated in current context</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderDecision = (data: DecisionIntelligenceResult) => {
    const getDecisionTheme = (decision: string) => {
      switch (decision) {
        case 'APPROVE':
          return {
            text: 'text-emerald-600 dark:text-[#4ade80]',
            bg: 'bg-emerald-500/10 dark:bg-[#10b981]/5',
            border: 'border-emerald-500/20 dark:border-[#10b981]/10',
            badge: 'bg-emerald-500 text-white dark:bg-[#10b981] dark:text-black font-bold'
          };
        case 'REVIEW':
          return {
            text: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-500/10 dark:bg-amber-500/5',
            border: 'border-amber-500/20 dark:border-amber-500/10',
            badge: 'bg-amber-500 text-white dark:text-black font-bold'
          };
        case 'ESCALATE':
          return {
            text: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-500/10 dark:bg-rose-500/5',
            border: 'border-rose-500/20 dark:border-rose-500/10',
            badge: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-[#050505] font-bold'
          };
        case 'REJECT':
          return {
            text: 'text-red-600 dark:text-red-400',
            bg: 'bg-red-500/10 dark:bg-red-500/5',
            border: 'border-red-500/20 dark:border-red-500/10',
            badge: 'bg-red-600 text-white dark:bg-red-500 dark:text-[#050505] font-bold'
          };
        default:
          return {
            text: 'text-slate-600 dark:text-slate-400',
            bg: 'bg-slate-500/10',
            border: 'border-slate-500/20',
            badge: 'bg-slate-500 text-white'
          };
      }
    };

    const theme = getDecisionTheme(data.decision);

    return (
      <div className="space-y-5">
        {/* Ultimate Consensus Panel */}
        <div className={`rounded border ${theme.border} ${theme.bg} p-5`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">AGENT 5 CORE CONGREGATION</span>
              <div className="flex items-center gap-2.5">
                <span className={`text-2xl font-extrabold tracking-tight ${theme.text}`}>{data.decision}</span>
                <span className={`rounded px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider ${theme.badge}`}>
                  {data.risk_level} RISK
                </span>
              </div>
            </div>

            <div className="flex gap-6 border-l border-slate-200/50 pl-6 dark:border-white/5">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Overall Risk Score</span>
                <span className="font-mono text-xl font-bold text-slate-800 dark:text-[#e0e0e0]">{data.overall_risk_score.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">Consensus Confidence</span>
                <span className="font-mono text-xl font-bold text-slate-800 dark:text-[#e0e0e0]">{(data.decision_confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Decision Reasoning narrative */}
        <div className="rounded border border-slate-150 bg-white p-4.5 dark:border-white/5 dark:bg-[#050505]">
          <h5 className="mb-1.5 text-xs font-bold text-slate-700 dark:text-[#e0e0e0] uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck size={13} className="text-[#c5a059]" />
            Agent reasoning &amp; evidence synthesis
          </h5>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-sans">
            {data.reasoning}
          </p>
        </div>

        {/* Positive/Negative lists */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-3.5 dark:border-emerald-500/10">
            <h6 className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider dark:text-[#4ade80] mb-1.5">Contributing Favorable Factors</h6>
            {data.positive_factors.length > 0 ? (
              <ul className="text-xs space-y-1">
                {data.positive_factors.map((fact, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <Check size={11} className="text-emerald-500" />
                    <span className="font-mono">{fact}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-slate-400 italic">None logged</span>
            )}
          </div>

          <div className="rounded border border-rose-500/20 bg-rose-500/5 p-3.5 dark:border-rose-500/10">
            <h6 className="text-[10px] font-bold text-rose-600 uppercase tracking-wider dark:text-rose-400 mb-1.5">Contributing Adversary Flags</h6>
            {data.negative_factors.length > 0 ? (
              <ul className="text-xs space-y-1">
                {data.negative_factors.map((fact, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                    <X size={11} className="text-rose-500" />
                    <span className="font-mono">{fact}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-xs text-slate-400 italic text-emerald-500 flex items-center gap-1">
                <Check size={11} /> No adversary factors triggered
              </span>
            )}
          </div>
        </div>

        {/* Decision Evidence breakdown */}
        <div>
          <h5 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Fused Multi-Agent weights</h5>
          <div className="overflow-x-auto rounded border border-slate-150 bg-white dark:border-white/5 dark:bg-[#050505]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase dark:border-white/5 dark:bg-[#050505]/80">
                  <th className="p-3">Agent Source</th>
                  <th className="p-3">Presence</th>
                  <th className="p-3">Disclosed Risk</th>
                  <th className="p-3">Observed Confidence</th>
                  <th className="p-3">Pre-Config Weight</th>
                  <th className="p-3 text-right">Fuzzy Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs text-slate-700 dark:divide-[#1a1a1a] dark:text-slate-300">
                {data.evidence_breakdown.map((ev, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                    <td className="p-3 font-semibold capitalize">{ev.source.replace('_', ' ')}</td>
                    <td className="p-3">
                      {ev.available ? (
                        <span className="text-emerald-500 font-bold font-mono">OK</span>
                      ) : (
                        <span className="text-slate-400 italic">N/A</span>
                      )}
                    </td>
                    <td className="p-3">{ev.risk_value !== null ? ev.risk_value.toFixed(4) : '—'}</td>
                    <td className="p-3">{ev.confidence !== null ? ev.confidence.toFixed(2) : '—'}</td>
                    <td className="p-3">{(ev.weight * 100).toFixed(0)}%</td>
                    <td className="p-3 text-right font-bold text-[#c5a059] dark:text-[#c5a059]">
                      {ev.contribution !== null ? ev.contribution.toFixed(4) : '0.0000'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (!currentStageResult || currentStageResult.status === 'pending') {
      return (
        <div className="flex h-64 flex-col items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50 dark:border-white/5 dark:bg-[#050505]">
          <span className="text-xs text-slate-400">Stage not yet evaluated</span>
          <p className="mt-1 text-[10px] text-slate-400">Mint a transaction token to trigger multi-agent orchestration.</p>
        </div>
      );
    }

    if (currentStageResult.status === 'running') {
      return (
        <div className="flex h-64 flex-col items-center justify-center rounded border border-slate-150 bg-white p-6 dark:border-white/5 dark:bg-[#050505]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#c5a059] border-t-transparent" />
          <span className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-400 animate-pulse">Running live calculations on Agent {activeTab}...</span>
        </div>
      );
    }

    if (currentStageResult.status === 'failed') {
      return (
        <div className="rounded border border-rose-500/20 bg-rose-500/5 p-6 dark:border-rose-500/10 dark:bg-rose-500/5">
          <div className="flex gap-3">
            <AlertTriangle className="text-rose-500 shrink-0" size={20} />
            <div>
              <h4 className="text-sm font-bold text-rose-700 dark:text-rose-400">Orchestration Halted: Agent Failed</h4>
              <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-500 font-mono leading-relaxed bg-rose-500/5 p-3 rounded-lg border border-rose-500/10">
                {currentStageResult.error || 'Unknown connection failure'}
              </p>
              <p className="mt-3 text-[11px] text-slate-500 leading-relaxed dark:text-white/40">
                On any stage failure, subsequent stages are bypassed, and the transaction is flagged for critical manual review. Check system logs / DB status.
              </p>
            </div>
          </div>
        </div>
      );
    }

    const res = currentStageResult.result;
    if (!res) {
      return (
        <div className="text-xs text-slate-400 italic">No structured data found for {activeTab}.</div>
      );
    }

    switch (activeTab) {
      case 'behavioral':
        return renderBehavioral(res as BehavioralDnaResult);
      case 'graph':
        return renderGraph(res as GraphIntelligenceResult);
      case 'trust':
        return renderTrust(res as TrustIntelligenceResult);
      case 'compliance':
        return renderCompliance(res as ComplianceIntelligenceResult);
      case 'decision':
        return renderDecision(res as DecisionIntelligenceResult);
      default:
        return null;
    }
  };

  return (
    <div className="rounded border border-slate-150 bg-white p-5 dark:border-white/5 dark:bg-[#0c0c0c]">
      {/* Navigation tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-150 pb-2 dark:border-white/5">
        {tabs.map(tab => {
          const stageStatus = stages.find(s => s.stage === tab.name)?.status || 'pending';
          const isSelected = activeTab === tab.name;

          return (
            <button
              key={tab.name}
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-bold rounded border transition-all ${
                isSelected
                  ? 'bg-slate-900 border-slate-900 text-white dark:bg-[#c5a059] dark:border-[#c5a059] dark:text-black uppercase'
                  : 'bg-transparent border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-white/40 dark:hover:text-[#e0e0e0] dark:hover:bg-white/5 uppercase'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {/* status indicator dot */}
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                stageStatus === 'completed'
                  ? 'bg-emerald-500'
                  : stageStatus === 'running'
                  ? 'bg-[#c5a059] animate-ping'
                  : stageStatus === 'failed'
                  ? 'bg-rose-500'
                  : 'bg-slate-300 dark:bg-white/10'
              }`} />
            </button>
          );
        })}
      </div>

      {/* Content wrapper */}
      <div className="mt-5 min-h-64">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
