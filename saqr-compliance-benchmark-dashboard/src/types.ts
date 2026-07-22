/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Core Types for SAQR Dashboard

export interface TransactionInput {
  account_id: string;
  receiver_account_id: string;
  amount: number;
  tx_type: string;
  customer_id?: string | null;
  occurred_at?: string | null;
}

export type StageName = 'behavioral' | 'graph' | 'trust' | 'compliance' | 'decision';
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface StageResult {
  stage: StageName;
  status: StageStatus;
  error: string | null;
  duration_ms: number;
  result: any; // Can be cast to specific stage results below
}

export interface DemoRunResponse {
  token: string;
  customer_id: string;
  failed: boolean;
  stages: StageResult[];
}

// Stage 1: Behavioral DNA Details
export interface BehavioralDnaVectorFeature {
  feature: string;
  group: string;
  count: number;
  mean: number;
  m2: number;
  variance: number;
  stddev: number;
}

export interface ChangedFeature {
  feature: string;
  group: string;
  baseline_mean: number;
  baseline_stddev: number;
  observed: number;
  z_score: number;
  deviation_level: string;
}

export interface BehavioralDnaResult {
  transaction_id: string;
  customer_id: string;
  account_id: string;
  receiver_account_id: string;
  profile_version: number;
  behavioral_risk_score: number;
  confidence_score: number;
  similarity_score: number;
  behavioral_dna_vector: BehavioralDnaVectorFeature[];
  changed_features: ChangedFeature[];
  explanation: string;
  occurred_at: string;
  generated_at: string;
  schema_version: string;
  saqr_token: string;
}

// Stage 2: Graph Intelligence Details
export interface StructuralFeatures {
  degree: number;
  weighted_degree: number;
  fan_in: number;
  fan_out: number;
  clustering_coefficient: number;
  shared_beneficiary_count: number;
  community_id: string;
  community_size: number;
  pagerank: number;
  betweenness: number;
  eigenvector: number;
  structural_complexity_score: number;
}

export interface GraphIntelligenceResult {
  entity_id: string;
  entity_type: string;
  transaction_id: string | null;
  graph_embedding: (number | string)[];
  structural_features: StructuralFeatures;
  community_id: string;
  community_size: number;
  neighborhood_stats: Record<string, any>;
  structural_anomalies: string[];
  graph_confidence_score: number;
  graph_metadata: Record<string, any>;
  generated_at: string;
  schema_version: string;
}

// Stage 3: Trust Intelligence Details
export interface TrustEvidence {
  source: string;
  available: boolean;
  score: number | null;
  confidence: number | null;
  quality: number | null;
  weight: number;
  contribution: number;
}

export interface TrustIntelligenceResult {
  transaction_id: string;
  customer_id: string;
  account_id: string;
  trust_score: number;
  confidence_level: number;
  evidence_breakdown: TrustEvidence[];
  dominant_positive_factors: string[];
  dominant_negative_factors: string[];
  missing_evidence: string[];
  explanation: string;
  generated_at: string;
  schema_version: string;
}

// Stage 4: Compliance Intelligence Details
export interface AssessmentSummary {
  passed: number;
  violated: number;
  unevaluated: number;
  score: number | null;
}

export interface ComplianceIntelligenceResult {
  transaction_id: string;
  customer_id: string;
  compliance_score: number;
  compliance_status: 'compliant' | 'non-compliant' | 'warning';
  compliance_confidence: number;
  aml_assessment: AssessmentSummary;
  kyc_assessment: AssessmentSummary;
  policy_assessment: AssessmentSummary;
  violated_rules: string[];
  passed_rules: string[];
  unevaluated_rules: string[];
  compliance_explanation: string[];
  generated_at: string;
  schema_version: string;
}

// Stage 5: Decision Intelligence Details
export interface DecisionEvidence {
  source: string;
  available: boolean;
  risk_value: number | null;
  confidence: number | null;
  weight: number;
  contribution: number;
}

export interface DecisionIntelligenceResult {
  transaction_id: string;
  customer_id: string;
  decision: 'APPROVE' | 'REVIEW' | 'ESCALATE' | 'REJECT';
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  overall_risk_score: number;
  decision_confidence: number;
  reasoning: string;
  contributing_agents: string[];
  positive_factors: string[];
  negative_factors: string[];
  evidence_breakdown: DecisionEvidence[];
  generated_at: string;
  schema_version: string;
}

// Audit Timeline
export interface TimelineEvent {
  event: string;
  detail: string;
  occurred_at: string;
}

// 2-Node Graph Relationship Details
export interface RelationshipMetrics {
  average_amount: number;
  relationship_age_seconds: number;
  structural_trust_score: number;
  temporal_consistency: number;
  transaction_regularity: number;
}

export interface RelationshipGraph {
  sender_id: string;
  receiver_id: string;
  metrics: RelationshipMetrics | null;
}

// Benchmark & Validation Suite Types

export type BenchmarkKind = 'pipeline' | 'tokens' | 'db';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface JobProgress {
  completed: number;
  total: number;
  successful: number;
  failed: number;
}

export interface BenchmarkJob {
  job_id: string;
  kind: BenchmarkKind;
  status: JobStatus;
  progress: JobProgress;
  result: any | null;
  error: string | null;
  started_at: number; // Unix timestamp
  finished_at: number | null; // Unix timestamp
}

// Report Latency Metrics
export interface LatencyMetrics {
  count: number;
  avg_ms: number;
  median_ms: number;
  p95_ms: number;
  p99_ms: number;
  min_ms: number;
  max_ms: number;
}

export interface ValueWithBadge<T = number> {
  value: T;
  source: 'measured' | 'projected' | 'estimated';
  note: string | null;
}

// Report Details
export interface PipelineReport {
  sample_size: number;
  concurrency: number;
  successful: number;
  failed: number;
  success_rate: number;
  latency: LatencyMetrics;
  throughput_tps: ValueWithBadge;
  per_stage_latency_ms: Record<StageName, LatencyMetrics>;
  full_dataset_size: number;
  full_dataset_projected_seconds: ValueWithBadge;
  failures: string[];
  tokens: string[];
  started_at: string;
  finished_at: string;
}

export interface TpsSample {
  t: number; // elapsed time in seconds
  tps: number;
}

export interface TokensReport {
  job_id: string;
  status: JobStatus;
  total_requested: number;
  total_customers: number;
  completed_count: number;
  successful: number;
  failed: number;
  recovered_on_retry: number;
  recovery_errors: number;
  database_failures: number;
  duplicate_tokens: number;
  unique_tokens: number;
  generation_rate_tps: ValueWithBadge;
  avg_latency_ms: ValueWithBadge;
  outage_window: [string, string] | null;
  lost_tokens_checked: number;
  lost_tokens_found: number;
  started_at: string;
  finished_at: string;
  tps_samples: TpsSample[];
  full_target_size: number;
  full_target_projected_seconds: ValueWithBadge;
}

export interface TraceabilityReport {
  tokens_checked: number;
  behavioral_completed: number;
  graph_completed: number;
  trust_completed: number;
  compliance_completed: number;
  decision_completed: number;
  fully_traced: number;
  success_rate: number;
}

export interface DatabaseOperationMetrics {
  operation: 'insert' | 'lookup' | 'update' | 'timeline';
  latency: LatencyMetrics;
}

export interface DatabaseReport {
  sample_size: number;
  insert: DatabaseOperationMetrics;
  lookup: DatabaseOperationMetrics;
  update: DatabaseOperationMetrics;
  timeline: DatabaseOperationMetrics;
  substitution_note: string;
}

export interface ContainerStat {
  name: string;
  cpu_percent: number;
  mem_usage_mb: number;
}

export interface TableMetric {
  table_name: string;
  row_count: number;
  size_bytes: number;
}

export interface CostComparison {
  label: string;
  saqr_value: string;
  traditional_value: string;
  saqr_source: 'measured' | 'projected' | 'estimated';
  traditional_source: 'measured' | 'projected' | 'estimated';
  explanation: string;
}

export interface InfraCostReport {
  captured: boolean;
  container_stats: ContainerStat[];
  database_size_bytes: number;
  table_metrics: TableMetric[];
  estimated_monthly_cost_usd: ValueWithBadge;
  cost_formula_note: string;
  comparison: CostComparison[];
}

export interface ReadinessItem {
  label: string;
  ok: boolean;
  label_kind: 'live-verified' | 'present-in-build';
  detail: string;
}

export interface BenchmarkReport {
  generated_at: string;
  pipeline: PipelineReport | null;
  tokens: TokensReport | null;
  traceability: TraceabilityReport | null;
  database: DatabaseReport | null;
  infra_cost: InfraCostReport | null;
  readiness: ReadinessItem[];
}
