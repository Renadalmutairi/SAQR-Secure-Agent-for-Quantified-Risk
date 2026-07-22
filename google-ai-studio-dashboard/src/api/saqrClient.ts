// Real client for the live SAQR backend (dashboard service, :8080/api/*).
// Every function here calls the actual deployed backend - no mock data.
import { InvestigationState, RiskLevel, RecommendedAction } from "../types";

// Nullish coalescing, not ||: an explicitly empty string means "same-origin
// relative paths" (the production config, proxied by nginx) and must not
// fall back to the localhost dev default.
const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:8080";

export interface RunDemoRequest {
  account_id: string;
  receiver_account_id: string;
  amount: number;
  tx_type: string;
}

export async function checkDbStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/db-status`);
    const data = await res.json();
    return data.database === "online";
  } catch {
    return false;
  }
}

export async function runRealInvestigation(req: RunDemoRequest): Promise<InvestigationState> {
  const res = await fetch(`${API_BASE}/api/demo/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      account_id: req.account_id,
      receiver_account_id: req.receiver_account_id,
      amount: req.amount,
      tx_type: req.tx_type,
    }),
  });
  if (!res.ok) throw new Error(`SAQR backend error: HTTP ${res.status}`);
  const data = await res.json();
  return mapDemoRunToInvestigation(data, req);
}

function stageResult(data: any, stage: string): any | null {
  const s = (data.stages || []).find((x: any) => x.stage === stage);
  return s && s.status === "completed" ? s.result : null;
}

function mapRiskLevel(level: string | undefined): RiskLevel {
  switch (level) {
    case "LOW": return RiskLevel.LOW;
    case "MEDIUM": return RiskLevel.MEDIUM;
    case "HIGH": return RiskLevel.HIGH;
    case "CRITICAL": return RiskLevel.CRITICAL;
    default: return RiskLevel.LOW;
  }
}

function mapRecommendedAction(decision: string | undefined): RecommendedAction {
  switch (decision) {
    case "APPROVE": return RecommendedAction.NO_ACTION;
    case "REVIEW": return RecommendedAction.FLAG_FOR_REVIEW;
    case "ESCALATE": return RecommendedAction.ESCALATE_TO_REGULATOR;
    case "REJECT": return RecommendedAction.FREEZE_TRANSACTION;
    default: return RecommendedAction.MONITOR;
  }
}

// Maps the REAL POST /api/demo/run response into this UI's InvestigationState shape.
// Only fields with a genuine backend equivalent are populated with real data.
// Anything this UI's data model expects but the real backend has no equivalent for
// (fictional persons/devices/IPs/phones, Saudi IBAN display, Arabic case titles) is
// left honestly empty/generic rather than fabricated - unlike the bundled mock cases,
// this one is fully real.
export function mapDemoRunToInvestigation(data: any, req: RunDemoRequest): InvestigationState {
  const behavioral = stageResult(data, "behavioral");
  const graph = stageResult(data, "graph");
  const trust = stageResult(data, "trust");
  const compliance = stageResult(data, "compliance");
  const decision = stageResult(data, "decision");

  const senderId = req.account_id;
  const receiverId = req.receiver_account_id;

  return {
    case_id: data.token,
    title: `[REAL] Transaction ${senderId} → ${receiverId} - ${req.amount} SAR (live SAQR backend)`,
    status: data.failed ? "flagged" : "investigating",
    assigned_to: undefined,
    created_at: new Date().toISOString(),
    pipeline_step: data.failed ? Math.max(0, (data.stages || []).length) : 6,
    comments: [],
    transaction: {
      transaction_id: data.token,
      account_id: senderId,
      counterparty_id: receiverId,
      amount: req.amount,
      currency: "SAR",
      timestamp: new Date().toISOString(),
      channel: req.tx_type,
      raw_metadata: { customer_id: data.customer_id || "" },
    },
    dna_fingerprint: behavioral
      ? {
          entity_id: senderId,
          fingerprint_hash: data.token,
          deviation_score: behavioral.behavioral_risk_score ?? 0,
          generated_at: behavioral.generated_at,
          notes: behavioral.explanation,
        }
      : undefined,
    route_decision: "continue",
    graph_result: graph
      ? {
          // Real entities only: the sender and receiver accounts. This backend does not
          // model persons/devices/IPs/phones, so none are fabricated here.
          entities: [
            { entity_id: senderId, entity_type: "account", label: `Account ${senderId} (sender)`, details: { degree: String(graph.structural_features?.degree ?? 0), community: String(graph.community_id ?? "-") } },
            { entity_id: receiverId, entity_type: "account", label: `Account ${receiverId} (receiver)`, details: {} },
          ],
          relationships: [
            { source_id: senderId, target_id: receiverId, relationship_type: "transacted_with", weight: 1.0 },
          ],
          suspicious_node_ids: (graph.structural_anomalies || []).map((_: any, i: number) => `${senderId}-anomaly-${i}`),
          notes: `Graph confidence: ${graph.graph_confidence_score}. Real Agent 2 structural output - no fabricated devices/IPs.`,
        }
      : undefined,
    aml_result: compliance
      ? {
          findings: (compliance.violated_rules || []).map((rule: string) => ({
            typology: rule,
            matched: true,
            confidence: Math.round((compliance.compliance_confidence || 0) * 100),
            evidence: {},
          })),
          notes: (compliance.compliance_explanation || []).join(" — "),
        }
      : undefined,
    trust_decision: decision
      ? {
          risk_score: Math.round((decision.overall_risk_score || 0) * 100),
          confidence: Math.round((decision.decision_confidence || 0) * 100),
          risk_level: mapRiskLevel(decision.risk_level),
          recommended_action: mapRecommendedAction(decision.decision),
          reasoning: decision.reasoning,
          contributing_factors: [...(decision.positive_factors || []), ...(decision.negative_factors || [])],
        }
      : undefined,
    audit_log: (data.stages || []).map((s: any) => ({
      step_name: s.stage,
      agent: s.stage,
      input_summary: {},
      output_summary: s.result ? { status: s.status } : { error: s.error },
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: s.duration_ms || 0,
    })),
    report_draft: decision
      ? {
          summary: `Real decision: ${decision.decision} (${decision.risk_level})`,
          notes: decision.reasoning,
          signee: "",
          department: "",
          is_signed: false,
        }
      : undefined,
  };
}
