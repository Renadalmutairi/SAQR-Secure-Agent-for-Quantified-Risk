/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  DemoRunResponse,
  StageResult,
  TimelineEvent,
  RelationshipGraph,
  BenchmarkJob,
  BenchmarkReport,
  StageName,
  JobStatus,
  TransactionInput,
  BenchmarkKind
} from '../types';

// Simple in-memory or localStorage state for the mock engine
class SAQRMockEngine {
  private tokens: Map<string, DemoRunResponse> = new Map();
  private timelines: Map<string, TimelineEvent[]> = new Map();
  private activeJobs: Map<string, BenchmarkJob> = new Map();
  private isOutageActive: boolean = false;
  private outageStartAt: string | null = null;
  private outageEndAt: string | null = null;
  private latestPipelineJobId: string | null = null;
  private latestTokensJobId: string | null = null;
  private latestDbJobId: string | null = null;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedTokens = localStorage.getItem('saqr_mock_tokens');
      if (storedTokens) {
        const parsed = JSON.parse(storedTokens);
        Object.entries(parsed).forEach(([token, val]) => {
          this.tokens.set(token, val as DemoRunResponse);
        });
      }
      const storedTimelines = localStorage.getItem('saqr_mock_timelines');
      if (storedTimelines) {
        const parsed = JSON.parse(storedTimelines);
        Object.entries(parsed).forEach(([token, val]) => {
          this.timelines.set(token, val as TimelineEvent[]);
        });
      }
      this.isOutageActive = localStorage.getItem('saqr_mock_outage_active') === 'true';
      this.outageStartAt = localStorage.getItem('saqr_mock_outage_start');
      this.outageEndAt = localStorage.getItem('saqr_mock_outage_end');
    } catch (e) {
      console.error('Failed to load mock engine state from storage', e);
    }
  }

  private saveToStorage() {
    try {
      const tokensObj = Object.fromEntries(this.tokens.entries());
      localStorage.setItem('saqr_mock_tokens', JSON.stringify(tokensObj));

      const timelinesObj = Object.fromEntries(this.timelines.entries());
      localStorage.setItem('saqr_mock_timelines', JSON.stringify(timelinesObj));

      localStorage.setItem('saqr_mock_outage_active', String(this.isOutageActive));
      if (this.outageStartAt) localStorage.setItem('saqr_mock_outage_start', this.outageStartAt);
      if (this.outageEndAt) localStorage.setItem('saqr_mock_outage_end', this.outageEndAt);
    } catch (e) {
      console.error('Failed to save mock engine state to storage', e);
    }
  }

  public generateTokenId(): string {
    const chars = '0123456789ABCDEF';
    let hex = '';
    for (let i = 0; i < 8; i++) {
      hex += chars[Math.floor(Math.random() * chars.length)];
    }
    return `SAQR-TX-${hex}`;
  }

  public isOutage(): boolean {
    return this.isOutageActive;
  }

  public setOutage(active: boolean) {
    this.isOutageActive = active;
    const nowIso = new Date().toISOString();
    if (active) {
      this.outageStartAt = nowIso;
      this.outageEndAt = null;
    } else {
      this.outageEndAt = nowIso;
    }
    this.saveToStorage();
  }

  public getTokensList(): string[] {
    return Array.from(this.tokens.keys());
  }

  public getToken(token: string): DemoRunResponse | null {
    return this.tokens.get(token) || null;
  }

  public getTimeline(token: string): TimelineEvent[] {
    return this.timelines.get(token) || [];
  }

  public getGraph(token: string): RelationshipGraph {
    const run = this.tokens.get(token);
    const sender = run?.stages[0]?.result?.account_id || '959';
    const receiver = run?.stages[0]?.result?.receiver_account_id || '450';
    const amount = run?.stages[0]?.result?.amount || 250.0;

    return {
      sender_id: sender,
      receiver_id: receiver,
      metrics: {
        average_amount: amount,
        relationship_age_seconds: 124500,
        structural_trust_score: 0.81,
        temporal_consistency: 0.92,
        transaction_regularity: 0.78
      }
    };
  }

  // Create a single demo run transaction through all 5 stages with customizable callback for streaming updates
  public async simulateDemoRun(
    input: TransactionInput,
    onUpdate: (response: DemoRunResponse, currentStage: StageName | 'done', log: string) => void
  ): Promise<DemoRunResponse> {
    const token = this.generateTokenId();
    const customerId = input.customer_id || `cust-${this.generateUuid()}`;
    const nowStr = new Date().toISOString();

    const timeline: TimelineEvent[] = [];
    const addTimelineEvent = (event: string, detail: string) => {
      timeline.push({
        event,
        detail,
        occurred_at: new Date().toISOString()
      });
    };

    // Initialize full empty response with all stages pending
    const runResponse: DemoRunResponse = {
      token,
      customer_id: customerId,
      failed: false,
      stages: [
        { stage: 'behavioral', status: 'pending', error: null, duration_ms: 0, result: null },
        { stage: 'graph', status: 'pending', error: null, duration_ms: 0, result: null },
        { stage: 'trust', status: 'pending', error: null, duration_ms: 0, result: null },
        { stage: 'compliance', status: 'pending', error: null, duration_ms: 0, result: null },
        { stage: 'decision', status: 'pending', error: null, duration_ms: 0, result: null }
      ]
    };

    this.tokens.set(token, runResponse);
    this.timelines.set(token, timeline);
    this.saveToStorage();

    // 1. Initial creation
    addTimelineEvent('Token Created', `SAQR Token ${token} generated for account ${input.account_id}`);
    onUpdate({ ...runResponse }, 'behavioral', 'Token generated and registered in Postgres.');
    await this.delay(600);

    // Helper to get stage reference
    const getStage = (name: StageName): StageResult => {
      return runResponse.stages.find(s => s.stage === name)!;
    };

    // STAGE 1: Behavioral
    getStage('behavioral').status = 'running';
    addTimelineEvent('Behavioral DNA Started', 'Fetching customer history profile and loading Redis cache');
    onUpdate({ ...runResponse }, 'behavioral', 'Comparing transaction features against baseline...');
    await this.delay(1200);

    if (this.isOutageActive) {
      getStage('behavioral').status = 'failed';
      getStage('behavioral').error = 'Postgres connection failed: terminating connection due to administrator command';
      runResponse.failed = true;
      addTimelineEvent('Behavioral DNA Failed', 'Database connection refused during profile query');
      this.tokens.set(token, runResponse);
      this.saveToStorage();
      onUpdate({ ...runResponse }, 'done', 'Behavioral profile fetch failed.');
      return runResponse;
    }

    const behavioralRisk = input.amount > 10000 ? 0.684 : 0.1423;
    const deviationLevel = input.amount > 10000 ? 'high' : 'moderate';
    const explanationText = input.amount > 10000 
      ? `High behavioral deviation detected: transaction amount (observed ${input.amount} SAR) is extremely high relative to baseline.`
      : `Behavioral deviation detected: tx_sequence_index was higher than usual (observed 185.00 vs typical 92.00 +/- 53.40, moderate deviation).`;

    getStage('behavioral').status = 'completed';
    getStage('behavioral').duration_ms = 1240.5;
    getStage('behavioral').result = {
      transaction_id: token,
      customer_id: customerId,
      account_id: input.account_id,
      receiver_account_id: input.receiver_account_id,
      profile_version: 186,
      behavioral_risk_score: behavioralRisk,
      confidence_score: 1.0,
      similarity_score: 0.5843,
      behavioral_dna_vector: [
        { feature: 'log_amount', group: 'amount', count: 186, mean: 6.049, m2: 106.26, variance: 0.571, stddev: 0.756 },
        { feature: 'tx_sequence_index', group: 'velocity', count: 186, mean: 92.5, m2: 536222.5, variance: 2882.92, stddev: 53.69 }
      ],
      changed_features: [
        {
          feature: 'tx_sequence_index',
          group: 'velocity',
          baseline_mean: 92.0,
          baseline_stddev: 53.40,
          observed: 185.0,
          z_score: 1.741,
          deviation_level: deviationLevel
        }
      ],
      explanation: explanationText,
      occurred_at: nowStr,
      generated_at: new Date().toISOString(),
      schema_version: '1.0',
      saqr_token: token
    };

    addTimelineEvent('Behavioral DNA Finished', `Calculated behavioral risk score: ${behavioralRisk}`);
    onUpdate({ ...runResponse }, 'graph', 'Behavioral DNA completed. Event pushed to Kafka. Initiating Graph Intelligence stage...');
    await this.delay(800);

    // STAGE 2: Graph
    getStage('graph').status = 'running';
    addTimelineEvent('Graph Analysis Started', 'Traversing relationships in Neo4j GDS');
    onUpdate({ ...runResponse }, 'graph', 'Executing Louvain Community and PageRank on Neo4j clusters...');
    await this.delay(1000);

    getStage('graph').status = 'completed';
    getStage('graph').duration_ms = 850.12;
    getStage('graph').result = {
      entity_id: input.account_id,
      entity_type: 'Account',
      transaction_id: null,
      graph_embedding: [0.0, 0.12, -0.42, 0.99, 0.0, 0.05],
      structural_features: {
        degree: 4,
        weighted_degree: 12500.0,
        fan_in: 2,
        fan_out: 2,
        clustering_coefficient: 0.35,
        shared_beneficiary_count: 1,
        community_id: '8',
        community_size: 45,
        pagerank: 0.185,
        betweenness: 0.012,
        eigenvector: 0.045,
        structural_complexity_score: input.amount > 15000 ? 0.75 : 0.12
      },
      community_id: '8',
      community_size: 45,
      neighborhood_stats: {},
      structural_anomalies: input.amount > 15000 ? ['High PageRank anomaly', 'Unusual structural complexity'] : [],
      graph_confidence_score: 0.85,
      graph_metadata: {},
      generated_at: new Date().toISOString(),
      schema_version: '1.0'
    };

    addTimelineEvent('Graph Analysis Finished', 'Neo4j analysis completed. Cluster structural score: 0.12');
    onUpdate({ ...runResponse }, 'trust', 'Graph analysis complete. Dispatching to evidence fusion trust engine...');
    await this.delay(600);

    // STAGE 3: Trust
    getStage('trust').status = 'running';
    addTimelineEvent('Trust Evaluation Started', 'Initiating trust evidence weight calculations');
    onUpdate({ ...runResponse }, 'trust', 'Fusing behavioral, historical, and structural scores...');
    await this.delay(1000);

    const trustVal = input.amount > 10000 ? 0.384 : 0.7261;
    getStage('trust').status = 'completed';
    getStage('trust').duration_ms = 910.45;
    getStage('trust').result = {
      transaction_id: token,
      customer_id: customerId,
      account_id: input.account_id,
      trust_score: trustVal,
      confidence_level: 0.75,
      evidence_breakdown: [
        { source: 'behavioral_dna', available: true, score: 0.8577, confidence: 1.0, quality: 1.0, weight: 0.4, contribution: 0.3431 },
        { source: 'device_trust', available: false, score: null, confidence: null, quality: null, weight: 0.2, contribution: 0.0 },
        { source: 'geographic_trust', available: false, score: null, confidence: null, quality: null, weight: 0.15, contribution: 0.0 },
        { source: 'relationship_trust', available: true, score: 0.68, confidence: 0.8, quality: 0.9, weight: 0.15, contribution: 0.0816 },
        { source: 'historical_trust', available: true, score: 0.998, confidence: 0.2, quality: 1.0, weight: 0.1, contribution: 0.02 }
      ],
      dominant_positive_factors: ['behavioral_dna', 'historical_trust'],
      dominant_negative_factors: input.amount > 10000 ? ['high_amount_risk'] : [],
      missing_evidence: ['device_trust', 'geographic_trust'],
      explanation: `Trust score ${trustVal.toFixed(2)} at confidence level 0.75. Evidence used: behavioral_dna, relationship_trust, historical_trust.`,
      generated_at: new Date().toISOString(),
      schema_version: '1.0'
    };

    addTimelineEvent('Trust Evaluation Finished', `Trust rating computed: ${trustVal}`);
    onUpdate({ ...runResponse }, 'compliance', 'Trust evaluation complete. Commencing policy, AML, and KYC assessments...');
    await this.delay(600);

    // STAGE 4: Compliance
    getStage('compliance').status = 'running';
    addTimelineEvent('Compliance Started', 'Running automated SAMA compliance rules');
    onUpdate({ ...runResponse }, 'compliance', 'Validating wire transaction thresholds and sanction registries...');
    await this.delay(1100);

    const isHighAmountViolated = input.amount > 100000;
    const complianceStatus = isHighAmountViolated ? 'warning' : 'compliant';
    const complianceScore = isHighAmountViolated ? 0.45 : 1.0;
    const complianceExp = isHighAmountViolated 
      ? [
          "AML/sanctions/reporting: 2 passed, 1 flagged warning, 16 unevaluated",
          "KYC/CDD: 2 passed, 0 violated, 6 unevaluated",
          "SAMA rule threshold SAMA-WIRE-005: warning issued for single transfer exceeding 100k SAR without special clearance",
          "4/29 registry rules could be automatically evaluated from this transaction's available data."
        ]
      : [
          "AML/sanctions/reporting: 2 passed, 0 violated, 17 unevaluated",
          "KYC/CDD: 2 passed, 0 violated, 6 unevaluated",
          "Internal governance/other: 0 passed, 0 violated, 2 unevaluated",
          "4/29 registry rules could be automatically evaluated from this transaction's available data; the remainder require evidence (audit trail, KYC file, screening logs) not yet integrated into SAQR"
        ];

    getStage('compliance').status = 'completed';
    getStage('compliance').duration_ms = 790.3;
    getStage('compliance').result = {
      transaction_id: token,
      customer_id: customerId,
      compliance_score: complianceScore,
      compliance_status: complianceStatus,
      compliance_confidence: 0.95,
      aml_assessment: { passed: 2, violated: isHighAmountViolated ? 1 : 0, unevaluated: 17, score: complianceScore },
      kyc_assessment: { passed: 2, violated: 0, unevaluated: 6, score: 1.0 },
      policy_assessment: { passed: 0, violated: 0, unevaluated: 2, score: null },
      violated_rules: isHighAmountViolated ? ['SAMA-WIRE-005'] : [],
      passed_rules: ['AML-CDD-002', 'AML-CDD-007', 'AML-WIRE-001', 'SANC-002'],
      unevaluated_rules: ['AML-CDD-001', 'AML-CDD-003', 'AML-CDD-005'],
      compliance_explanation: complianceExp,
      generated_at: new Date().toISOString(),
      schema_version: '1.0'
    };

    addTimelineEvent('Compliance Finished', `Compliance check finished. Status: ${complianceStatus.toUpperCase()}`);
    onUpdate({ ...runResponse }, 'decision', 'Compliance review finished. Moving to Agent 5 for ultimate decision...');
    await this.delay(600);

    // STAGE 5: Decision
    getStage('decision').status = 'running';
    addTimelineEvent('Decision Generated', 'Collating scores for ultimate approval verdict');
    onUpdate({ ...runResponse }, 'decision', 'Compiling multi-agent fused decision tree...');
    await this.delay(1200);

    // Decision based on input and rules
    let decisionVal: 'APPROVE' | 'REVIEW' | 'ESCALATE' | 'REJECT' = 'APPROVE';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let overallRiskScore = 0.1399;

    if (input.amount > 100000) {
      decisionVal = 'REJECT';
      riskLevel = 'CRITICAL';
      overallRiskScore = 0.895;
    } else if (input.amount > 10000) {
      decisionVal = 'REVIEW';
      riskLevel = 'MEDIUM';
      overallRiskScore = 0.485;
    }

    const reasoningText = isHighAmountViolated 
      ? `Overall risk score ${overallRiskScore} (CRITICAL) based on severe behavioral deviation and SAMA wire threshold violation (SAMA-WIRE-005). Fused consensus recommends REJECT.`
      : `Overall risk score ${overallRiskScore} (${riskLevel}) at decision confidence 0.55, based on 2/4 available agents. Evidence: Behavioral DNA: risk ${behavioralRisk} (LOW). Final decision: ${decisionVal}.`;

    getStage('decision').status = 'completed';
    getStage('decision').duration_ms = 1320.65;
    getStage('decision').result = {
      transaction_id: token,
      customer_id: customerId,
      decision: decisionVal,
      risk_level: riskLevel,
      overall_risk_score: overallRiskScore,
      decision_confidence: 0.88,
      reasoning: reasoningText,
      contributing_agents: ['behavioral_dna', 'trust_intelligence', 'compliance'],
      positive_factors: input.amount > 10000 ? [] : ['Trust Intelligence: trust score 0.73', 'Behavioral DNA: risk low'],
      negative_factors: input.amount > 100000 ? ['Compliance: SAMA-WIRE-005 violation', 'Behavioral: high deviation'] : [],
      evidence_breakdown: [
        { source: 'behavioral', available: true, risk_value: behavioralRisk, confidence: 1.0, weight: 0.3, contribution: behavioralRisk * 0.3 },
        { source: 'graph', available: true, risk_value: input.amount > 15000 ? 0.6 : 0.12, confidence: 0.85, weight: 0.25, contribution: 0.05 },
        { source: 'trust', available: true, risk_value: 1 - trustVal, confidence: 0.75, weight: 0.25, contribution: (1 - trustVal) * 0.25 },
        { source: 'compliance', available: true, risk_value: 1 - complianceScore, confidence: 0.95, weight: 0.2, contribution: (1 - complianceScore) * 0.2 }
      ],
      generated_at: new Date().toISOString(),
      schema_version: '1.0'
    };

    this.tokens.set(token, runResponse);
    this.timelines.set(token, timeline);
    this.saveToStorage();

    onUpdate({ ...runResponse }, 'done', `Ultimate transaction decision: ${decisionVal}. Finished.`);
    return runResponse;
  }

  // Background Job Simulations

  public startBenchmark(kind: BenchmarkKind, body: any): BenchmarkJob {
    const jobId = this.generateUuid();
    const total = kind === 'pipeline' ? (body.sample_size || 1000) : kind === 'tokens' ? (body.total || 50000) : (body.sample_size || 300);
    
    const newJob: BenchmarkJob = {
      job_id: jobId,
      kind,
      status: 'running',
      progress: {
        completed: 0,
        total,
        successful: 0,
        failed: 0
      },
      result: null,
      error: null,
      started_at: Date.now() / 1000,
      finished_at: null
    };

    this.activeJobs.set(jobId, newJob);
    
    if (kind === 'pipeline') this.latestPipelineJobId = jobId;
    if (kind === 'tokens') this.latestTokensJobId = jobId;
    if (kind === 'db') this.latestDbJobId = jobId;

    // Start background processor
    this.processJobAsync(jobId);

    return newJob;
  }

  private async processJobAsync(jobId: string) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    const total = job.progress.total;
    const steps = 15;
    const sleepDuration = Math.max(200, Math.min(1200, 4000 / steps)); // dynamic sleep

    for (let i = 1; i <= steps; i++) {
      await this.delay(sleepDuration);
      
      const currentJob = this.activeJobs.get(jobId);
      if (!currentJob || currentJob.status !== 'running') break;

      const completed = Math.floor((i / steps) * total);
      
      // Simulate some error failures if outage is active
      let failuresCount = currentJob.progress.failed;
      let successCount = currentJob.progress.successful;
      
      const increment = completed - currentJob.progress.completed;
      if (this.isOutageActive && currentJob.kind === 'tokens') {
        // High failure rate during outage
        const chunkFailed = Math.floor(increment * 0.6);
        failuresCount += chunkFailed;
        successCount += (increment - chunkFailed);
      } else {
        // normal small failure rate
        const chunkFailed = Math.floor(increment * (Math.random() * 0.005)); // 0.5% failure
        failuresCount += chunkFailed;
        successCount += (increment - chunkFailed);
      }

      currentJob.progress = {
        completed,
        total,
        successful: successCount,
        failed: failuresCount
      };

      this.activeJobs.set(jobId, { ...currentJob });
    }

    const finalJob = this.activeJobs.get(jobId);
    if (finalJob && finalJob.status === 'running') {
      finalJob.status = 'completed';
      finalJob.finished_at = Date.now() / 1000;
      finalJob.progress.completed = total;
      
      if (finalJob.kind === 'tokens' && this.isOutageActive) {
        // outage active forced failures
        finalJob.progress.failed = 175;
        finalJob.progress.successful = total - 175;
      }

      this.activeJobs.set(jobId, finalJob);
    }
  }

  public getJob(jobId: string): BenchmarkJob | null {
    return this.activeJobs.get(jobId) || null;
  }

  public getLatestJob(kind: BenchmarkKind): BenchmarkJob | null {
    const jobId = kind === 'pipeline' ? this.latestPipelineJobId : kind === 'tokens' ? this.latestTokensJobId : this.latestDbJobId;
    return jobId ? this.getJob(jobId) : null;
  }

  // Build full report matching the exact structure from the Technical Brief
  public getReport(): BenchmarkReport {
    const nowIso = new Date().toISOString();

    const pipelineJob = this.latestPipelineJobId ? this.getJob(this.latestPipelineJobId) : null;
    const tokensJob = this.latestTokensJobId ? this.getJob(this.latestTokensJobId) : null;
    const dbJob = this.latestDbJobId ? this.getJob(this.latestDbJobId) : null;

    // Generate dynamic values based on job states or return nice static brief data
    return {
      generated_at: nowIso,
      pipeline: {
        sample_size: 1000,
        concurrency: 20,
        successful: pipelineJob && pipelineJob.status === 'completed' ? pipelineJob.progress.successful : 851,
        failed: pipelineJob && pipelineJob.status === 'completed' ? pipelineJob.progress.failed : 149,
        success_rate: pipelineJob && pipelineJob.status === 'completed' ? pipelineJob.progress.successful / 1000 : 0.851,
        latency: {
          count: 872,
          avg_ms: 31678.65,
          median_ms: 30516.86,
          p95_ms: 45885.58,
          p99_ms: 56041.54,
          min_ms: 8192.53,
          max_ms: 71286.65
        },
        throughput_tps: { value: 0.5928, source: 'measured', note: null },
        per_stage_latency_ms: {
          behavioral: { count: 872, avg_ms: 4205.64, median_ms: 3834.08, p95_ms: 8370.07, p99_ms: 11132.56, min_ms: 285.52, max_ms: 16482.99 },
          graph: { count: 851, avg_ms: 395.69, median_ms: 277.47, p95_ms: 961.41, p99_ms: 1519.02, min_ms: 58.48, max_ms: 5995.32 },
          trust: { count: 851, avg_ms: 1104.59, median_ms: 830.16, p95_ms: 2792.91, p99_ms: 6043.97, min_ms: 163.79, max_ms: 7914.85 },
          compliance: { count: 851, avg_ms: 1308.28, median_ms: 1039.94, p95_ms: 2989.45, p99_ms: 6410.30, min_ms: 207.11, max_ms: 7745.63 },
          decision: { count: 851, avg_ms: 1542.98, median_ms: 1308.33, p95_ms: 3308.25, p99_ms: 5280.90, min_ms: 270.66, max_ms: 7078.85 }
        },
        full_dataset_size: 117533,
        full_dataset_projected_seconds: {
          value: 198282.87,
          source: 'projected',
          note: 'Extrapolated from measured throughput (0.59 tx/s) over 1000 real sampled transactions - not a live full-dataset run.'
        },
        failures: [
          "Server error '500 Internal Server Error' for url 'http://compliance-intelligence-engine:8004/api/compliance/evaluate'",
          "Network timeout of 10000ms exceeded on behavioral lookup"
        ],
        tokens: ['SAQR-TX-368B0F76', 'SAQR-TX-BCE6E2FE', 'SAQR-TX-9DF5D90A', 'SAQR-TX-B9A04FB2'],
        started_at: '2026-07-17T07:16:42.593191Z',
        finished_at: '2026-07-17T07:40:38.212465Z'
      },
      tokens: {
        job_id: tokensJob ? tokensJob.job_id : '6a4295b6-d5b7-4aa2-9b49-bcdaacc628ef',
        status: tokensJob ? tokensJob.status : 'completed',
        total_requested: tokensJob ? tokensJob.progress.total : 50000,
        total_customers: 5000,
        completed_count: tokensJob ? tokensJob.progress.completed : 50000,
        successful: tokensJob ? tokensJob.progress.successful : 49825,
        failed: tokensJob ? tokensJob.progress.failed : 175,
        recovered_on_retry: 129,
        recovery_errors: 175,
        database_failures: 175,
        duplicate_tokens: 0,
        unique_tokens: tokensJob ? tokensJob.progress.successful : 49825,
        generation_rate_tps: { value: 34.84, source: 'measured', note: null },
        avg_latency_ms: { value: 1680.42, source: 'measured', note: null },
        outage_window: this.outageStartAt && this.outageEndAt ? [this.outageStartAt, this.outageEndAt] : null,
        lost_tokens_checked: 2000,
        lost_tokens_found: 2,
        started_at: '2026-07-17T07:16:42.660937Z',
        finished_at: '2026-07-17T07:40:32.651483Z',
        tps_samples: [
          { t: 0, tps: 34.2 },
          { t: 5, tps: 38.25 },
          { t: 10, tps: 41.1 },
          { t: 15, tps: 39.8 },
          { t: 20, tps: 15.2 }, // outage start
          { t: 25, tps: 0.0 },
          { t: 30, tps: 0.0 },
          { t: 35, tps: 18.5 }, // recovery
          { t: 40, tps: 35.1 },
          { t: 45, tps: 36.9 },
          { t: 50, tps: 34.8 }
        ],
        full_target_size: 1000000,
        full_target_projected_seconds: {
          value: 28701.30,
          source: 'projected',
          note: 'Extrapolated from a real 50,000-token run at 34.84 tokens/sec - a live 1,000,000-token run was not completed in this session.'
        }
      },
      traceability: {
        tokens_checked: 872,
        behavioral_completed: 849,
        graph_completed: 847,
        trust_completed: 843,
        compliance_completed: 841,
        decision_completed: 839,
        fully_traced: 837,
        success_rate: 0.9599
      },
      database: {
        sample_size: dbJob ? dbJob.progress.total : 300,
        insert: { operation: 'insert', latency: { count: 300, avg_ms: 35.44, median_ms: 29.51, p95_ms: 69.38, p99_ms: 78.79, min_ms: 18.45, max_ms: 95.50 } },
        lookup: { operation: 'lookup', latency: { count: 300, avg_ms: 20.85, median_ms: 16.38, p95_ms: 35.65, p99_ms: 67.96, min_ms: 10.69, max_ms: 478.63 } },
        update: { operation: 'update', latency: { count: 300, avg_ms: 41.37, median_ms: 32.64, p95_ms: 74.64, p99_ms: 215.67, min_ms: 20.26, max_ms: 435.76 } },
        timeline: { operation: 'timeline', latency: { count: 300, avg_ms: 21.65, median_ms: 19.92, p95_ms: 34.98, p99_ms: 51.995, min_ms: 11.86, max_ms: 56.28 } },
        substitution_note: "Agent 1 only exposes one detail endpoint (GET /tokens/{token}), so 'lookup latency' and 'token detail retrieval latency' would be the same measurement under two labels. Substituted PATCH status-update latency as a genuinely distinct 4th operation."
      },
      infra_cost: {
        captured: true,
        container_stats: [
          { name: 'saqrai-dashboard-1', cpu_percent: 77.11, mem_usage_mb: 136.5 },
          { name: 'saqrai-behavioral-dna-engine-1', cpu_percent: 245.36, mem_usage_mb: 237.2 },
          { name: 'saqrai-decision-intelligence-engine-1', cpu_percent: 0.4, mem_usage_mb: 42.28 },
          { name: 'saqrai-compliance-intelligence-engine-1', cpu_percent: 0.51, mem_usage_mb: 41.77 },
          { name: 'saqrai-graph-intelligence-engine-1', cpu_percent: 9.78, mem_usage_mb: 68.9 },
          { name: 'saqrai-trust-intelligence-engine-1', cpu_percent: 0.32, mem_usage_mb: 40.56 },
          { name: 'saqrai-neo4j-1', cpu_percent: 103.6, mem_usage_mb: 1173.5 },
          { name: 'saqrai-postgres-1', cpu_percent: 64.28, mem_usage_mb: 187.5 },
          { name: 'saqrai-kafka-1', cpu_percent: 5.31, mem_usage_mb: 760.8 },
          { name: 'saqrai-redis-1', cpu_percent: 1.58, mem_usage_mb: 10.2 }
        ],
        database_size_bytes: 387857431,
        table_metrics: [
          { table_name: 'token_registry', row_count: 72214, size_bytes: 21331968 },
          { table_name: 'token_audit_events', row_count: 80309, size_bytes: 14499840 },
          { table_name: 'token_stage_results', row_count: 4640, size_bytes: 8282112 }
        ],
        estimated_monthly_cost_usd: {
          value: 130.17,
          source: 'estimated',
          note: 'Formula: (vCPU-equiv 5.08 x $0.033/hr + RAM 2.64GB x $0.004/hr) x 730hrs + storage 0.361GB x $0.1/GB-month. Rates are a stated, generic mid-tier cloud reference point, not a vendor quote.'
        },
        cost_formula_note: 'CPU/RAM captured via `docker stats` during the live benchmark run; storage via real Postgres pg_database_size.',
        comparison: [
          {
            label: 'Database operations',
            saqr_value: '1 unified registry (3 tables); all 5 agents share it via transaction_id',
            traditional_value: 'Each of the 5 services owns its own ID/audit tables - up to 5x the write paths',
            saqr_source: 'measured',
            traditional_source: 'estimated',
            explanation: 'Verified fact of this repo: Agents 2-5 have zero identity/audit tables of their own.'
          },
          {
            label: 'Token management',
            saqr_value: '1 generation point (Agent 1), reused everywhere as transaction_id',
            traditional_value: 'N independent ID generators, one per service, needing cross-service reconciliation',
            saqr_source: 'measured',
            traditional_source: 'estimated',
            explanation: 'No schema changes were needed in Agents 2-5 to add tokenization - confirmed in this build.'
          },
          {
            label: 'Infrastructure complexity',
            saqr_value: '3 tables, 1 service touches Postgres for cross-agent tracking',
            traditional_value: '~15 tables (illustrative: one registry-equivalent set per service)',
            saqr_source: 'measured',
            traditional_source: 'estimated',
            explanation: 'Illustrative multiplier from this repo\'s real per-service table count, not a rigorous TCO model.'
          },
          {
            label: 'Storage overhead',
            saqr_value: '42.07 MB across 3 tables (measured)',
            traditional_value: '~210.35 MB (illustrative, same multiplier)',
            saqr_source: 'measured',
            traditional_source: 'estimated',
            explanation: 'Traditional-side figure is a modeled projection - there is no traditional deployment to measure.'
          },
          {
            label: 'Scalability',
            saqr_value: 'Adding a 6th agent needs zero new identity infrastructure - it just uses transaction_id',
            traditional_value: 'Adding a 6th service means building and maintaining another independent ID/audit system',
            saqr_source: 'measured',
            traditional_source: 'estimated',
            explanation: 'Architectural fact, demonstrated across Agents 2-5 in this build.'
          },
          {
            label: 'Operational cost',
            saqr_value: '1 registry to monitor/back up/audit for full cross-agent traceability',
            traditional_value: 'N separate registries to monitor/back up/reconcile for the same traceability',
            saqr_source: 'measured',
            traditional_source: 'estimated',
            explanation: 'Qualitative operational argument, not a dollar figure - no traditional deployment exists to price.'
          }
        ]
      },
      readiness: [
        { label: 'Health Monitoring', ok: true, label_kind: 'live-verified', detail: '5/5 agents responded healthy at report generation time' },
        { label: 'PostgreSQL', ok: !this.isOutageActive, label_kind: 'live-verified', detail: this.isOutageActive ? 'Connection failed' : 'Real SELECT 1 via Agent 1' },
        { label: 'Dockerized Architecture', ok: true, label_kind: 'present-in-build', detail: 'All 10 services run as Docker containers via docker-compose.yml' },
        { label: 'Kafka', ok: true, label_kind: 'present-in-build', detail: 'Agent 1 -> Agent 2 event stream (saqr.behavioral-dna.profile-updates)' },
        { label: 'Neo4j', ok: true, label_kind: 'present-in-build', detail: 'Agent 2\'s graph store (Louvain/PageRank/betweenness via GDS)' },
        { label: 'REST APIs', ok: true, label_kind: 'present-in-build', detail: 'Every agent exposes a typed FastAPI REST contract' },
        { label: 'Multi-Agent Architecture', ok: true, label_kind: 'present-in-build', detail: '5 independently deployable agents plus an orchestration/visualization layer' },
        { label: 'Token Traceability', ok: true, label_kind: 'present-in-build', detail: 'SAQR token = transaction_id, threaded through all 5 agents\' existing contracts unchanged' },
        { label: 'Audit Trail', ok: true, label_kind: 'present-in-build', detail: 'Immutable token_audit_events table, append-only' },
        { label: 'Benchmark Validation', ok: true, label_kind: 'present-in-build', detail: 'This suite - 5 benchmarks executed against the real backend' },
        { label: 'Infrastructure Cost Analysis', ok: true, label_kind: 'present-in-build', detail: 'Real docker stats + real Postgres size, explicitly labeled cost formula' }
      ]
    };
  }

  // Utility delays
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const mockEngine = new SAQRMockEngine();
