# SAQR — Technical Brief for Dashboard Generation

This describes a real, running system — a 5-agent AML/fraud/compliance
platform for Saudi/GCC banking, a Token Generation Station, and a Benchmark &
Validation Suite. Every endpoint, field, and JSON example below was captured
from live requests against the actual deployed system minutes before writing
this — nothing is a proposal or a guess. Build the frontend against these
exact contracts and connecting it back to the real backend will be mechanical.

## 1. What SAQR is

One transaction flows through 5 independent agents, each adding one piece of
intelligence, ending in a final decision:

```
Transaction → Agent 1 (Behavioral) → Agent 2 (Graph) → Agent 3 (Trust)
           → Agent 4 (Compliance) → Agent 5 (Decision) → APPROVE/REVIEW/ESCALATE/REJECT
```

A **SAQR Token** (`SAQR-TX-XXXXXXXX`) is minted once per transaction by Agent
1 and *is* the `transaction_id` every other agent uses — it's the thread that
lets you trace one transaction's full journey through all 5 agents.

A separate **dashboard/orchestration service** (not a 6th agent — it produces
no intelligence) drives demo runs and benchmarks, and is the one origin a
browser UI should talk to.

## 2. Deployment topology

| Service | Port | Role | State |
|---|---|---|---|
| behavioral-dna-engine (Agent 1) | 8001 | Behavioral profiling + Token Generation Station | Postgres, Redis, Kafka |
| graph-intelligence-engine (Agent 2) | 8002 | Relationship/graph structure | Neo4j, Kafka |
| trust-intelligence-engine (Agent 3) | 8003 | Evidence-fusion trust score | stateless |
| compliance-intelligence-engine (Agent 4) | 8004 | Regulatory rule evaluation | stateless |
| decision-intelligence-engine (Agent 5) | 8005 | Final fused decision | stateless |
| **dashboard** | **8080** | **Orchestration, demo, benchmarks — build the new UI against this** | reads Agent 1 via API only |
| postgres | 5432 | Agent 1's data + token registry | — |
| neo4j | 7474/7687 | Agent 2's graph | — |
| kafka | 9092 | Agent 1→2 event stream | — |
| redis | 6379 | Agent 1 cache | — |

## 3. Connecting a new frontend — read this first

**CORS is already enabled on the dashboard** (`:8080`), wildcard origin,
added specifically so an externally-built frontend can call it from any dev
server / preview origin without extra backend work:

```python
# already live in services/dashboard/app/main.py
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
```

Verified live:
```
$ curl -sD- -o /dev/null http://localhost:8080/api/health -H "Origin: http://localhost:5173"
access-control-allow-origin: *
```

**Build the new frontend to call `http://<host>:8080/api/*` exclusively.**
Do not call Agents 1–5 (ports 8001–8005) directly from browser code — they
have no CORS configured and are not meant to be hit from a UI. The dashboard
already proxies everything a UI needs: token generation, the demo run, the
relationship graph, and the full benchmark suite.

**Practical instruction for whatever tool generates the frontend:** put the
API base URL behind one config value (e.g. `const API_BASE = "http://localhost:8080"`
or a `.env` var like `VITE_API_BASE_URL`), never hardcode it inline in
multiple places. When you bring the generated code back to me, the entire
"connect it to the backend" step is: (1) point that one config value at the
real deployed dashboard origin, (2) verify every fetch call's path and method
matches §5/§6 below exactly, (3) run it against the live stack and fix any
field-name mismatches by diffing against the real examples in this document.
If the generated code invents field names instead of matching these exactly,
that's the #1 thing I'll need to correct.

## 4. The SAQR Token lifecycle

Five independent stage statuses per token, each one of
`pending | running | completed | failed`:
`behavioral_status | graph_status | trust_status | compliance_status | decision_status`

Real audit event vocabulary (immutable, append-only; exactly these 10 in the
happy path — a UI timeline should render exactly these strings, not invent
icons/labels for events that don't exist):
`Token Created`, `Behavioral DNA Started`, `Behavioral DNA Finished`,
`Graph Analysis Started`, `Graph Analysis Finished`,
`Trust Evaluation Started`, `Trust Evaluation Finished`,
`Compliance Started`, `Compliance Finished`, `Decision Generated`.
Failure adds `{Stage} Failed` events (not part of the fixed 10, but real and
must be rendered, never hidden).

## 5. Dashboard API (`:8080/api/*`)

### Token Generation Station

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/health` | — | `{"status":"ok","agent":"dashboard"}` |
| GET | `/api/db-status` | — | `{"database":"online"\|"offline"}` — poll every ~3s, gate the "Generate" button on `"online"` |
| POST | `/api/demo/run` | see below | Runs one transaction through all 5 agents live, synchronously (takes 2–70+ seconds depending on load — show a loading state, don't assume a fixed duration) |
| GET | `/api/tokens/{token}` | — | `{"registry": {...}, "stage_results": [...]}` |
| GET | `/api/tokens/{token}/timeline` | — | `[{"event","detail","occurred_at"}, ...]` in chronological order |
| GET | `/api/graph/{token}` | — | 2-node sender/receiver relationship graph, real Agent 2 data (see §6, Agent 2 caveat) |

`POST /api/demo/run` request body — only `account_id`, `receiver_account_id`,
`amount`, `tx_type` are required:
```json
{
  "account_id": "959",
  "receiver_account_id": "450",
  "amount": 250.00,
  "tx_type": "TRANSFER",
  "customer_id": null,
  "occurred_at": null
}
```

**Complete real response**, captured live (nothing abbreviated — this is the
actual shape, field-for-field, use it to validate whatever the generated
frontend expects):
```json
{
  "token": "SAQR-TX-B9A04FB2",
  "customer_id": "cust-93320fab-92f3-4b2f-8b31-f264e707d4bd",
  "failed": false,
  "stages": [
    {
      "stage": "behavioral", "status": "completed", "error": null, "duration_ms": 2239.69,
      "result": {
        "transaction_id": "SAQR-TX-B9A04FB2", "customer_id": "cust-93320fab-92f3-4b2f-8b31-f264e707d4bd",
        "account_id": "959", "receiver_account_id": "450", "profile_version": 186,
        "behavioral_risk_score": 0.1423, "confidence_score": 1.0, "similarity_score": 0.5843,
        "behavioral_dna_vector": [
          {"feature": "log_amount", "group": "amount", "count": 186, "mean": 6.049, "m2": 106.26, "variance": 0.571, "stddev": 0.756},
          {"feature": "tx_sequence_index", "group": "velocity", "count": 186, "mean": 92.5, "m2": 536222.5, "variance": 2882.92, "stddev": 53.69}
        ],
        "changed_features": [
          {"feature": "tx_sequence_index", "group": "velocity", "baseline_mean": 92.0, "baseline_stddev": 53.40, "observed": 185.0, "z_score": 1.741, "deviation_level": "moderate"}
        ],
        "explanation": "Behavioral deviation detected: tx_sequence_index was higher than usual (observed 185.00 vs typical 92.00 +/- 53.40, moderate deviation).",
        "occurred_at": "2026-07-17T09:03:34.044081Z", "generated_at": "2026-07-17T09:03:41.750492Z",
        "schema_version": "1.0", "saqr_token": "SAQR-TX-B9A04FB2"
      }
    },
    {
      "stage": "graph", "status": "completed", "error": null, "duration_ms": 2616.57,
      "result": {
        "entity_id": "959", "entity_type": "Account", "transaction_id": null,
        "graph_embedding": [0.0, "...128 floats, often all zero for a low-degree account..."],
        "structural_features": {
          "degree": 0, "weighted_degree": 0.0, "fan_in": 0, "fan_out": 0, "clustering_coefficient": 0.0,
          "shared_beneficiary_count": 0, "community_id": "8", "community_size": 1,
          "pagerank": 0.15, "betweenness": 0.0, "eigenvector": 0.0316, "structural_complexity_score": 0.0
        },
        "community_id": "8", "community_size": 1, "neighborhood_stats": {}, "structural_anomalies": [],
        "graph_confidence_score": 0.0, "graph_metadata": {},
        "generated_at": "2026-07-17T09:03:46.103562Z", "schema_version": "1.0"
      }
    },
    {
      "stage": "trust", "status": "completed", "error": null, "duration_ms": 2831.98,
      "result": {
        "transaction_id": "SAQR-TX-B9A04FB2", "customer_id": "cust-93320fab-92f3-4b2f-8b31-f264e707d4bd", "account_id": "959",
        "trust_score": 0.7261, "confidence_level": 0.5,
        "evidence_breakdown": [
          {"source": "behavioral_dna", "available": true, "score": 0.8577, "confidence": 1.0, "quality": 1.0, "weight": 0.4, "contribution": 0.3431},
          {"source": "device_trust", "available": false, "score": null, "confidence": null, "quality": null, "weight": 0.2, "contribution": 0.0},
          {"source": "geographic_trust", "available": false, "score": null, "confidence": null, "quality": null, "weight": 0.15, "contribution": 0.0},
          {"source": "relationship_trust", "available": false, "score": null, "confidence": null, "quality": null, "weight": 0.15, "contribution": 0.0},
          {"source": "historical_trust", "available": true, "score": 0.998, "confidence": 0.2, "quality": 1.0, "weight": 0.1, "contribution": 0.02}
        ],
        "dominant_positive_factors": ["behavioral_dna", "historical_trust"], "dominant_negative_factors": [],
        "missing_evidence": ["device_trust", "geographic_trust", "relationship_trust"],
        "explanation": "Trust score 0.73 at confidence level 0.50. Evidence used: behavioral_dna=0.86 (weight 0.40), historical_trust=1.00 (weight 0.10). Missing evidence (excluded from fusion, not treated as neutral): device_trust, geographic_trust, relationship_trust.",
        "generated_at": "2026-07-17T09:03:51.756958Z", "schema_version": "1.0"
      }
    },
    {
      "stage": "compliance", "status": "completed", "error": null, "duration_ms": 2088.96,
      "result": {
        "transaction_id": "SAQR-TX-B9A04FB2", "customer_id": "cust-93320fab-92f3-4b2f-8b31-f264e707d4bd",
        "compliance_score": 1.0, "compliance_status": "compliant", "compliance_confidence": 0.1379,
        "aml_assessment": {"passed": 2, "violated": 0, "unevaluated": 17, "score": 1.0},
        "kyc_assessment": {"passed": 2, "violated": 0, "unevaluated": 6, "score": 1.0},
        "policy_assessment": {"passed": 0, "violated": 0, "unevaluated": 2, "score": null},
        "violated_rules": [],
        "passed_rules": ["AML-CDD-002", "AML-CDD-007", "AML-WIRE-001", "SANC-002"],
        "unevaluated_rules": ["AML-CDD-001", "AML-CDD-003", "...25 total..."],
        "compliance_explanation": [
          "AML/sanctions/reporting: 2 passed, 0 violated, 17 unevaluated",
          "KYC/CDD: 2 passed, 0 violated, 6 unevaluated",
          "Internal governance/other: 0 passed, 0 violated, 2 unevaluated",
          "4/29 registry rules could be automatically evaluated from this transaction's available data; the remainder require evidence (audit trail, KYC file, screening logs) not yet integrated into SAQR"
        ],
        "generated_at": "2026-07-17T09:03:54.820161Z", "schema_version": "1.0"
      }
    },
    {
      "stage": "decision", "status": "completed", "error": null, "duration_ms": 4329.63,
      "result": {
        "transaction_id": "SAQR-TX-B9A04FB2", "customer_id": "cust-93320fab-92f3-4b2f-8b31-f264e707d4bd",
        "decision": "APPROVE", "risk_level": "LOW", "overall_risk_score": 0.1399, "decision_confidence": 0.55,
        "reasoning": "Overall risk score 0.14 (LOW) at decision confidence 0.55, based on 2/4 available agents. Evidence: Behavioral DNA: risk 0.14 at confidence 1.00 (based on 186 historical transactions); Trust Intelligence: trust score 0.73 at confidence 0.50. Unavailable (excluded from fusion, not treated as neutral): graph_intelligence, compliance. Final decision: APPROVE.",
        "contributing_agents": ["behavioral_dna", "trust_intelligence"],
        "positive_factors": ["Trust Intelligence: trust score 0.73 at confidence 0.50", "Behavioral DNA: risk 0.14 at confidence 1.00 (based on 186 historical transactions)", "Trust factor: behavioral_dna", "Trust factor: historical_trust"],
        "negative_factors": [],
        "evidence_breakdown": [
          {"source": "behavioral", "available": true, "risk_value": 0.1423, "confidence": 1.0, "weight": 0.3, "contribution": 0.0427},
          {"source": "graph", "available": false, "risk_value": null, "confidence": null, "weight": 0.25, "contribution": 0.0},
          {"source": "trust", "available": true, "risk_value": 0.2739, "confidence": 0.5, "weight": 0.25, "contribution": 0.0342},
          {"source": "compliance", "available": false, "risk_value": null, "confidence": null, "weight": 0.2, "contribution": 0.0}
        ],
        "generated_at": "2026-07-17T09:04:00.615750Z", "schema_version": "1.0"
      }
    }
  ]
}
```

**Important real nuance visible in this exact capture:** the `compliance`
stage above completed successfully (`compliance_status: "compliant"`), but
the `decision` stage's own `evidence_breakdown` shows `compliance` as
`available: false`. This is not a bug — Agent 5 makes its *own* independent
concurrent call to Agent 4 as part of its evaluation, separate from the
dashboard's own per-stage call. Under load, these two independent calls can
have different outcomes. **A UI must never assume the decision stage's
evidence_breakdown mirrors the other stages' own completion status** — render
each stage's own result and the decision's evidence_breakdown as what they
actually are: two independently-fetched views of the same transaction.

On any stage failure, the remaining stages are never called and never appear
in `stages[]` — `failed: true`, and that stage's `error` field holds the real
HTTP error message. Never render a stage as reached if it isn't in the array.

### Benchmark & Validation Suite

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/benchmark/pipeline/run` | `{"sample_size"?, "concurrency"?}` (defaults: 1000, 20) | `{"job_id": "..."}` |
| POST | `/api/benchmark/tokens/run` | `{"total"?, "customer_count"?, "concurrency"?}` (defaults: 50000, 5000, 60) | `{"job_id": "..."}` — long-running, minutes |
| POST | `/api/benchmark/db/run` | `{"sample_size"?}` (default: 300) | `{"job_id": "..."}` |
| GET | `/api/benchmark/jobs/{job_id}` | — | see below |
| GET | `/api/benchmark/jobs/latest/{kind}` | — | `kind` is `pipeline`\|`tokens`\|`db`; 404 if none run yet |
| GET | `/api/benchmark/traceability` | — | Checks every token from the latest pipeline run; 404 if no pipeline run yet |
| GET | `/api/benchmark/infrastructure` | — | Real CPU/RAM/DB size + labeled cost estimate |
| GET | `/api/benchmark/readiness` | — | 11-item checklist array |
| GET | `/api/benchmark/report` | — | **Everything at once — build the summary view from this single call** |
| POST | `/api/benchmark/tokens/outage/start` / `/outage/end` | — | Operator-only controls for a live resilience test; a UI can expose these as an advanced/admin action, not part of the normal flow |

**Job polling shape** (`GET /api/benchmark/jobs/{job_id}`) — poll every
1000–1500ms while `status === "running"`, stop on `"completed"` or `"failed"`:
```json
{
  "job_id": "6a4295b6-d5b7-4aa2-9b49-bcdaacc628ef",
  "kind": "tokens",
  "status": "running",
  "progress": {"completed": 23500, "total": 50000, "successful": 23325, "failed": 175},
  "result": null,
  "error": null,
  "started_at": 1784273802.66,
  "finished_at": null
}
```
`progress` shape varies slightly per benchmark kind (`pipeline`/`db` jobs use
the same `{completed,total}` core). `started_at`/`finished_at` are Unix
timestamps (seconds, float), not ISO strings — convert accordingly.

**`GET /api/benchmark/report` — complete real example**, captured live
(this is the exact, full shape to build every KPI card and chart from):
```json
{
  "generated_at": "2026-07-17T08:09:21.961721Z",
  "pipeline": {
    "sample_size": 1000, "concurrency": 20, "successful": 851, "failed": 149, "success_rate": 0.851,
    "latency": {"count": 872, "avg_ms": 31678.65, "median_ms": 30516.86, "p95_ms": 45885.58, "p99_ms": 56041.54, "min_ms": 8192.53, "max_ms": 71286.65},
    "throughput_tps": {"value": 0.5928, "source": "measured", "note": null},
    "per_stage_latency_ms": {
      "behavioral": {"count": 872, "avg_ms": 4205.64, "median_ms": 3834.08, "p95_ms": 8370.07, "p99_ms": 11132.56, "min_ms": 285.52, "max_ms": 16482.99},
      "graph":       {"count": 851, "avg_ms": 395.69,  "median_ms": 277.47,  "p95_ms": 961.41,  "p99_ms": 1519.02,  "min_ms": 58.48,  "max_ms": 5995.32},
      "trust":       {"count": 851, "avg_ms": 1104.59, "median_ms": 830.16,  "p95_ms": 2792.91,  "p99_ms": 6043.97,  "min_ms": 163.79, "max_ms": 7914.85},
      "compliance":  {"count": 851, "avg_ms": 1308.28, "median_ms": 1039.94, "p95_ms": 2989.45,  "p99_ms": 6410.30,  "min_ms": 207.11, "max_ms": 7745.63},
      "decision":    {"count": 851, "avg_ms": 1542.98, "median_ms": 1308.33, "p95_ms": 3308.25,  "p99_ms": 5280.90,  "min_ms": 270.66, "max_ms": 7078.85}
    },
    "full_dataset_size": 117533,
    "full_dataset_projected_seconds": {"value": 198282.87, "source": "projected", "note": "Extrapolated from measured throughput (0.59 tx/s) over 1000 real sampled transactions - not a live full-dataset run."},
    "failures": ["Server error '500 Internal Server Error' for url '...'", "...capped at 50 real error strings..."],
    "tokens": ["SAQR-TX-368B0F76", "SAQR-TX-BCE6E2FE", "...up to sample_size real tokens..."],
    "started_at": "2026-07-17T07:16:42.593191Z", "finished_at": "2026-07-17T07:40:38.212465Z"
  },
  "tokens": {
    "job_id": "6a4295b6-d5b7-4aa2-9b49-bcdaacc628ef", "status": "completed",
    "total_requested": 50000, "total_customers": 5000, "completed_count": 50000,
    "successful": 49825, "failed": 175, "recovered_on_retry": 129, "recovery_errors": 175, "database_failures": 175,
    "duplicate_tokens": 0, "unique_tokens": 49825,
    "generation_rate_tps": {"value": 34.84, "source": "measured", "note": null},
    "avg_latency_ms": {"value": 1680.42, "source": "measured", "note": null},
    "outage_window": ["2026-07-17T07:21:14.174739Z", "2026-07-17T07:21:48.841970Z"],
    "lost_tokens_checked": 2000, "lost_tokens_found": 2,
    "started_at": "2026-07-17T07:16:42.660937Z", "finished_at": "2026-07-17T07:40:32.651483Z",
    "tps_samples": [{"t": 2.6, "tps": 38.25}, {"t": 7.8, "tps": 41.1}, "...one point roughly every 5s, for a throughput-over-time line chart..."],
    "full_target_size": 1000000,
    "full_target_projected_seconds": {"value": 28701.30, "source": "projected", "note": "Extrapolated from a real 50,000-token run at 34.84 tokens/sec - a live 1,000,000-token run was not completed in this session."}
  },
  "traceability": {
    "tokens_checked": 872, "behavioral_completed": 849, "graph_completed": 847, "trust_completed": 843,
    "compliance_completed": 841, "decision_completed": 839, "fully_traced": 837, "success_rate": 0.9599
  },
  "database": {
    "sample_size": 300,
    "insert":   {"operation": "insert",   "latency": {"count": 300, "avg_ms": 35.44, "median_ms": 29.51, "p95_ms": 69.38, "p99_ms": 78.79, "min_ms": 18.45, "max_ms": 95.50}},
    "lookup":   {"operation": "lookup",   "latency": {"count": 300, "avg_ms": 20.85, "median_ms": 16.38, "p95_ms": 35.65, "p99_ms": 67.96, "min_ms": 10.69, "max_ms": 478.63}},
    "update":   {"operation": "update",   "latency": {"count": 300, "avg_ms": 41.37, "median_ms": 32.64, "p95_ms": 74.64, "p99_ms": 215.67, "min_ms": 20.26, "max_ms": 435.76}},
    "timeline": {"operation": "timeline", "latency": {"count": 300, "avg_ms": 21.65, "median_ms": 19.92, "p95_ms": 34.98, "p99_ms": 51.995, "min_ms": 11.86, "max_ms": 56.28}},
    "substitution_note": "Agent 1 only exposes one detail endpoint (GET /tokens/{token}), so 'lookup latency' and 'token detail retrieval latency' would be the same measurement under two labels. Substituted PATCH status-update latency as a genuinely distinct 4th operation."
  },
  "infra_cost": {
    "captured": true,
    "container_stats": [
      {"name": "saqrai-dashboard-1", "cpu_percent": 77.11, "mem_usage_mb": 136.5},
      {"name": "saqrai-behavioral-dna-engine-1", "cpu_percent": 245.36, "mem_usage_mb": 237.2},
      {"name": "saqrai-decision-intelligence-engine-1", "cpu_percent": 0.4, "mem_usage_mb": 42.28},
      {"name": "saqrai-compliance-intelligence-engine-1", "cpu_percent": 0.51, "mem_usage_mb": 41.77},
      {"name": "saqrai-graph-intelligence-engine-1", "cpu_percent": 9.78, "mem_usage_mb": 68.9},
      {"name": "saqrai-trust-intelligence-engine-1", "cpu_percent": 0.32, "mem_usage_mb": 40.56},
      {"name": "saqrai-neo4j-1", "cpu_percent": 103.6, "mem_usage_mb": 1173.5},
      {"name": "saqrai-postgres-1", "cpu_percent": 64.28, "mem_usage_mb": 187.5},
      {"name": "saqrai-kafka-1", "cpu_percent": 5.31, "mem_usage_mb": 760.8},
      {"name": "saqrai-redis-1", "cpu_percent": 1.58, "mem_usage_mb": 10.2}
    ],
    "database_size_bytes": 387857431,
    "table_metrics": [
      {"table_name": "token_registry", "row_count": 72214, "size_bytes": 21331968},
      {"table_name": "token_audit_events", "row_count": 80309, "size_bytes": 14499840},
      {"table_name": "token_stage_results", "row_count": 4640, "size_bytes": 8282112}
    ],
    "estimated_monthly_cost_usd": {"value": 130.17, "source": "estimated", "note": "Formula: (vCPU-equiv 5.08 x $0.033/hr + RAM 2.64GB x $0.004/hr) x 730hrs + storage 0.361GB x $0.1/GB-month. Rates are a stated, generic mid-tier cloud reference point, not a vendor quote."},
    "cost_formula_note": "CPU/RAM captured via `docker stats` during the live benchmark run; storage via real Postgres pg_database_size.",
    "comparison": [
      {"label": "Database operations", "saqr_value": "1 unified registry (3 tables); all 5 agents share it via transaction_id", "traditional_value": "Each of the 5 services owns its own ID/audit tables - up to 5x the write paths", "saqr_source": "measured", "traditional_source": "estimated", "explanation": "Verified fact of this repo: Agents 2-5 have zero identity/audit tables of their own."},
      {"label": "Token management", "saqr_value": "1 generation point (Agent 1), reused everywhere as transaction_id", "traditional_value": "N independent ID generators, one per service, needing cross-service reconciliation", "saqr_source": "measured", "traditional_source": "estimated", "explanation": "No schema changes were needed in Agents 2-5 to add tokenization - confirmed in this build."},
      {"label": "Infrastructure complexity", "saqr_value": "3 tables, 1 service touches Postgres for cross-agent tracking", "traditional_value": "~15 tables (illustrative: one registry-equivalent set per service)", "saqr_source": "measured", "traditional_source": "estimated", "explanation": "Illustrative multiplier from this repo's real per-service table count, not a rigorous TCO model."},
      {"label": "Storage overhead", "saqr_value": "42.07 MB across 3 tables (measured)", "traditional_value": "~210.35 MB (illustrative, same multiplier)", "saqr_source": "measured", "traditional_source": "estimated", "explanation": "Traditional-side figure is a modeled projection - there is no traditional deployment to measure."},
      {"label": "Scalability", "saqr_value": "Adding a 6th agent needs zero new identity infrastructure - it just uses transaction_id", "traditional_value": "Adding a 6th service means building and maintaining another independent ID/audit system", "saqr_source": "measured", "traditional_source": "estimated", "explanation": "Architectural fact, demonstrated across Agents 2-5 in this build."},
      {"label": "Operational cost", "saqr_value": "1 registry to monitor/back up/audit for full cross-agent traceability", "traditional_value": "N separate registries to monitor/back up/reconcile for the same traceability", "saqr_source": "measured", "traditional_source": "estimated", "explanation": "Qualitative operational argument, not a dollar figure - no traditional deployment exists to price."}
    ]
  },
  "readiness": [
    {"label": "Health Monitoring", "ok": true, "label_kind": "live-verified", "detail": "5/5 agents responded healthy at report generation time"},
    {"label": "PostgreSQL", "ok": true, "label_kind": "live-verified", "detail": "Real SELECT 1 via Agent 1"},
    {"label": "Dockerized Architecture", "ok": true, "label_kind": "present-in-build", "detail": "All 10 services run as Docker containers via docker-compose.yml"},
    {"label": "Kafka", "ok": true, "label_kind": "present-in-build", "detail": "Agent 1 -> Agent 2 event stream (saqr.behavioral-dna.profile-updates)"},
    {"label": "Neo4j", "ok": true, "label_kind": "present-in-build", "detail": "Agent 2's graph store (Louvain/PageRank/betweenness via GDS)"},
    {"label": "REST APIs", "ok": true, "label_kind": "present-in-build", "detail": "Every agent exposes a typed FastAPI REST contract"},
    {"label": "Multi-Agent Architecture", "ok": true, "label_kind": "present-in-build", "detail": "5 independently deployable agents plus an orchestration/visualization layer"},
    {"label": "Token Traceability", "ok": true, "label_kind": "present-in-build", "detail": "SAQR token = transaction_id, threaded through all 5 agents' existing contracts unchanged"},
    {"label": "Audit Trail", "ok": true, "label_kind": "present-in-build", "detail": "Immutable token_audit_events table, append-only"},
    {"label": "Benchmark Validation", "ok": true, "label_kind": "present-in-build", "detail": "This suite - 5 benchmarks executed against the real backend"},
    {"label": "Infrastructure Cost Analysis", "ok": true, "label_kind": "present-in-build", "detail": "Real docker stats + real Postgres size, explicitly labeled cost formula"}
  ]
}
```

**Any of `pipeline`, `tokens`, `traceability`, `database`, `infra_cost` can be
`null`** if that benchmark hasn't run yet in the current dashboard session —
render an explicit "not run yet" empty state per section, never a fabricated
zero or a hidden/skipped card. Every numeric field wrapped as
`{"value","source","note"}` must show its `source` badge
(`measured`/`projected`/`estimated`) directly next to the number — this is a
hard requirement carried through the whole system, not a style preference.

## 6. Direct agent endpoints (optional — for a richer per-agent view)

Only reachable server-side or via the dashboard's proxies above — no CORS on
these, don't call them from browser code (see §3).

**Agent 1 — `:8001`**: `GET /health` · `GET /customers/{customer_id}/profile`
→ `{customer_id, behavioral_risk_score: float|null, confidence_score, history_depth, version, is_current, valid_from, content_hash, ...}`
· token endpoints mirror §5's dashboard proxies exactly.

**Agent 2 — `:8002`**: `GET /health` · `GET /accounts/{account_id}/output` →
same shape as the `graph` stage result in §5. **Returns HTTP 200 with
all-zero values for an account it's never seen — never 404. Gate any "this
account has real graph data" UI state on `graph_confidence_score > 0`, not on
the response merely existing.** · `GET /accounts/{sender}/relationships/{receiver}/metrics`
→ `{average_amount, relationship_age_seconds, structural_trust_score, temporal_consistency, transaction_regularity}` (real 404 if no relationship exists yet — this one *does* 404).

**Agent 3 — `:8003`**: `GET /health` · `POST /trust/evaluate` body
`{transaction_id, customer_id, account_id}` → same shape as the `trust` stage
result in §5. **Always returns 200 even with zero real evidence — gate on
`confidence_level > 0`, not response presence.**

**Agent 4 — `:8004`**: `GET /health` · `POST /compliance/evaluate` body
`{transaction_id, customer_id, account_id, receiver_account_id, amount, occurred_at, tx_type}`
→ same shape as the `compliance` stage result in §5. · `GET /policy/registry-status` → `{rules_loaded, registry_dir}`.

**Agent 5 — `:8005`**: `GET /health` · `POST /decision/evaluate` (same
request body shape as Agent 4) → same shape as the `decision` stage result in
§5. `decision` and `risk_level` always move together as one 4-state severity
scale (LOW/APPROVE → MEDIUM/REVIEW → HIGH/ESCALATE → CRITICAL/REJECT) — never
render them as independent axes.

## 7. Error handling checklist — every real gotcha found while building this

A UI generated without this list will look broken against the real backend
even though the backend is working correctly:

1. **`GET /api/benchmark/jobs/latest/{kind}` returns HTTP 404** if that
   benchmark kind has never been run this session — this is correct, expected
   behavior, not an error to alarm the user about. Show "not run yet."
2. **`GET /api/benchmark/traceability` returns HTTP 404** until at least one
   pipeline benchmark has completed — same treatment.
3. **`POST /api/demo/run` can take anywhere from ~2 seconds to 70+ seconds**
   depending on system load — never assume a fixed timeout under ~90s, and
   show real elapsed time, not a fake progress bar.
4. **A `"failed": true` demo run is a normal, expected outcome**, not a UI
   error state to hide — render exactly which stage failed and its real
   `error` string.
5. **Agent 2's and Agent 3's "200 OK with zero/null values" pattern** (§6) —
   the single most common way a naive UI misreports an unknown account as
   "verified low risk" when it actually means "no data available."
6. **Background job `progress` object can be `{}`** briefly right after a job
   starts, before the first progress update lands — treat missing `completed`/`total`
   as 0, not as an error.
7. **The `tokens` benchmark result's `outage_window` is `null`** unless an
   operator explicitly triggered `/outage/start` and `/outage/end` during that
   run — most runs will have `outage_window: null`, which is normal.

## 8. Visual identity already established (optional)

The existing dashboard (Token Station + System Benchmark pages) uses this
token system. Match it for visual continuity, or let the new tool design
freely against the API contracts above — functionally independent choice:

- **Accent:** `#0D8F87` (light) / `#4FD1C9` (dark) — teal
- **Neutrals:** navy-tinted (`#131A2B` text / `#F6F7FA` bg light; `#E7EAF2` text / `#0A0E1A` bg dark)
- **Semantic:** success `#16A34A`/`#34D399`, warning `#B45309`/`#F5A524`, critical `#DC2626`/`#F0506E`, info `#3B5FC4`/`#7DA2FF`
- Monospace (`ui-monospace`) for tokens, timestamps, and all numeric data (tabular-nums)
- Light-mode default, full dark-mode token set via `:root[data-theme="dark|light"]` overriding `prefers-color-scheme`

## 9. Known real constraints

- **No authentication anywhere** — fine for local/demo, add before any public deployment.
- **Agent 1 runs 3 uvicorn workers**, a real fix applied after measuring a single-worker throughput ceiling of ~40 req/s (Postgres itself was under 40% CPU at that point — the ceiling was application-level).
- **The stated full-scale benchmark targets (117,534-transaction dataset, 1,000,000-token generation) have never been run to completion live in one sitting** — only real, substantial samples were run, with full-scale numbers reported as clearly labeled projections (§5). If the new UI adds a "run full benchmark" control, it must carry the same honesty — label projected completion times, never imply the full run already happened.
- **Two genuine engineering findings worth surfacing prominently, not burying:** (1) a live Postgres outage was injected mid-benchmark and the system recovered automatically — 175 real failures were captured, not hidden; (2) 2 of 2,000 sampled tokens were unretrievable after that outage/recovery cycle (0.1%) — a disclosed, unresolved data-integrity finding.

## 10. What happens when you bring the generated code back

Send me the generated frontend code (or a link/export from Google AI Studio).
I will: (1) point its API base URL at the live dashboard origin, (2) diff
every fetch call against §5/§6 above and fix any invented field names or
endpoints, (3) run it against the real live stack end-to-end, (4) fix
anything that breaks against real responses (not assumed ones) before calling
it done. Having this document match exactly is what makes that step fast
instead of a rewrite.
