export enum RecommendedAction {
  NO_ACTION = "no_action",
  MONITOR = "monitor",
  FLAG_FOR_REVIEW = "flag_for_review",
  FREEZE_TRANSACTION = "freeze_transaction",
  ESCALATE_TO_REGULATOR = "escalate_to_regulator",
}

export enum RiskLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export interface TransactionInput {
  transaction_id: string;
  account_id: string;
  counterparty_id?: string;
  amount: number;
  currency: string;
  timestamp: string;
  channel?: string; // e.g., "wire", "card", "internal_transfer"
  raw_metadata?: Record<string, any>;
}

export interface DNAFingerprint {
  entity_id: string;
  fingerprint_hash: string;
  deviation_score: number; // 0.0 - 1.0 (deviation from baseline)
  generated_at: string;
  notes?: string;
}

export interface GraphEntity {
  entity_id: string;
  entity_type: "person" | "company" | "wallet" | "device" | "ip" | "phone" | "bank" | "account" | string;
  label: string;
  details?: Record<string, string>;
}

export interface GraphRelationship {
  source_id: string;
  target_id: string;
  relationship_type: "owns" | "transacted_with" | "shares_device" | "uses_ip" | "uses_phone" | string;
  weight: number;
}

export interface GraphAnalysisResult {
  entities: GraphEntity[];
  relationships: GraphRelationship[];
  suspicious_node_ids: string[];
  notes?: string;
}

export interface AMLFinding {
  typology: "layering" | "structuring" | "smurfing" | "circular_transactions" | "high_velocity" | string;
  matched: boolean;
  confidence: number; // 0-100
  evidence: Record<string, any>;
}

export interface AMLAnalysisResult {
  findings: AMLFinding[];
  notes?: string;
}

export interface TrustDecision {
  risk_score: number; // 0-100
  confidence: number; // 0-100
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  reasoning: string;
  contributing_factors: string[];
}

export interface AuditEntry {
  step_name: string;
  agent: string;
  input_summary: Record<string, any>;
  output_summary: Record<string, any>;
  started_at: string;
  finished_at: string;
  duration_ms: number;
}

export interface InvestigationState {
  case_id: string;
  title: string;
  status: "new" | "investigating" | "completed" | "flagged" | "frozen" | "archived";
  assigned_to?: string;
  created_at: string;
  transaction: TransactionInput;
  
  // Pipeline details (filled sequentially during the investigation run)
  dna_fingerprint?: DNAFingerprint;
  route_decision?: "continue" | "fast_track";
  graph_result?: GraphAnalysisResult;
  aml_result?: AMLAnalysisResult;
  trust_decision?: TrustDecision;
  
  audit_log: AuditEntry[];
  
  // UI interaction state
  pipeline_step: number; // 0: input, 1: DNA, 2: Supervisor, 3: Graph, 4: AML, 5: Trust, 6: Final Report
  comments?: string[];
  report_draft?: {
    summary: string;
    notes: string;
    signee: string;
    department: string;
    is_signed: boolean;
    signed_at?: string;
  };
}

export interface Alert {
  id: string;
  case_id: string;
  type: "high_risk" | "new_case" | "deadline" | "escalation";
  message: string;
  timestamp: string;
  unread: boolean;
  severity: "info" | "warning" | "critical";
}
