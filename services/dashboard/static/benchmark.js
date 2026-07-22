(function () {
  "use strict";
  const API = "";

  // ---------------- theme (same pattern as app.js) ----------------
  const themeToggle = document.getElementById("theme-toggle");
  function currentTheme() {
    return document.documentElement.getAttribute("data-theme");
  }
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("saqr-theme", t);
  }
  const savedTheme = localStorage.getItem("saqr-theme");
  if (savedTheme) setTheme(savedTheme);
  themeToggle.addEventListener("click", () => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effective = currentTheme() || (prefersDark ? "dark" : "light");
    setTheme(effective === "dark" ? "light" : "dark");
    refreshReport(); // re-render charts with the new theme's colors
  });

  function toast(message, type) {
    const stack = document.getElementById("toast-stack");
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  function sourceBadge(source) {
    if (!source) return '<span class="source-badge unavailable">n/a</span>';
    return `<span class="source-badge ${source}">${source}</span>`;
  }

  function fmt(n, digits) {
    if (n === null || n === undefined) return "—";
    return Number(n).toLocaleString(undefined, { maximumFractionDigits: digits === undefined ? 1 : digits });
  }

  // ---------------- job polling ----------------
  const jobProgressList = document.getElementById("job-progress-list");
  const jobElements = {};

  function ensureJobRow(kind) {
    if (jobElements[kind]) return jobElements[kind];
    const wrap = document.createElement("div");
    wrap.className = "job-progress";
    wrap.innerHTML = `
      <div class="job-progress-label" data-role="label">${kind}: starting…</div>
      <div class="job-progress-bar"><div class="job-progress-fill" data-role="fill" style="width:0%"></div></div>
    `;
    jobProgressList.appendChild(wrap);
    jobElements[kind] = wrap;
    return wrap;
  }

  async function startJob(kind, path, body) {
    const row = ensureJobRow(kind);
    row.querySelector('[data-role="label"]').textContent = `${kind}: launching…`;
    try {
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { job_id } = await res.json();
      pollJob(kind, job_id, row);
    } catch (err) {
      toast(`${kind} failed to start: ${err.message}`, "error");
    }
  }

  function pollJob(kind, jobId, row) {
    const label = row.querySelector('[data-role="label"]');
    const fill = row.querySelector('[data-role="fill"]');
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API}/api/benchmark/jobs/${jobId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const job = await res.json();
        const progress = job.progress || {};
        const completed = progress.completed || 0;
        const total = progress.total || 1;
        const pct = Math.min(100, Math.round((completed / total) * 100));
        fill.style.width = pct + "%";

        if (job.status === "running") {
          label.textContent = `${kind}: ${completed.toLocaleString()} / ${total.toLocaleString()} (${pct}%)`;
        } else if (job.status === "completed") {
          clearInterval(interval);
          fill.style.width = "100%";
          label.textContent = `${kind}: completed`;
          toast(`${kind} completed.`, "success");
          refreshReport();
        } else if (job.status === "failed") {
          clearInterval(interval);
          label.textContent = `${kind}: failed — ${job.error || "unknown error"}`;
          toast(`${kind} failed: ${job.error || "unknown error"}`, "error");
        }
      } catch (err) {
        clearInterval(interval);
        toast(`Lost track of ${kind} job: ${err.message}`, "error");
      }
    }, 1500);
  }

  document.getElementById("run-pipeline").addEventListener("click", () => startJob("Pipeline", "/api/benchmark/pipeline/run"));
  document.getElementById("run-tokens").addEventListener("click", () => startJob("Tokens", "/api/benchmark/tokens/run"));
  document.getElementById("run-db").addEventListener("click", () => startJob("Database", "/api/benchmark/db/run"));
  document.getElementById("refresh-report").addEventListener("click", refreshReport);

  document.getElementById("mark-outage-start").addEventListener("click", async () => {
    await fetch(`${API}/api/benchmark/tokens/outage/start`, { method: "POST" });
    document.getElementById("outage-status").textContent = "Outage window open — recording failures as database_failures.";
    toast("Outage window marked open.", "success");
  });
  document.getElementById("mark-outage-end").addEventListener("click", async () => {
    await fetch(`${API}/api/benchmark/tokens/outage/end`, { method: "POST" });
    document.getElementById("outage-status").textContent = "Outage window closed.";
    toast("Outage window marked closed.", "success");
  });

  // ---------------- report rendering ----------------
  async function refreshReport() {
    let report;
    try {
      const res = await fetch(`${API}/api/benchmark/report`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      report = await res.json();
    } catch (err) {
      toast(`Could not load report: ${err.message}`, "error");
      return;
    }
    renderKpis(report);
    renderCharts(report);
    renderReliability(report);
    renderPerformance(report);
    renderReadiness(report);
    renderCost(report);
    renderExecutiveReport(report);
  }

  function kpiCard(label, value, sub, source) {
    return `<div class="card kpi-card">
      <span class="kpi-label">${label}</span>
      <span class="kpi-value">${value}</span>
      <span class="kpi-sub">${sub || ""} ${source ? sourceBadge(source) : ""}</span>
    </div>`;
  }

  function renderKpis(report) {
    const p = report.pipeline, t = report.tokens, tr = report.traceability, db = report.database, cost = report.infra_cost, ready = report.readiness || [];
    const grid = document.getElementById("kpi-grid");

    const overallOk = ready.length > 0 && ready.every((r) => r.ok);
    const cards = [
      kpiCard(
        "Transactions Processed",
        p ? fmt(p.successful, 0) + " / " + fmt(p.sample_size, 0) : "—",
        p ? `real sample of ${fmt(p.full_dataset_size, 0)} in dataset` : "not run yet",
        p ? "measured" : null
      ),
      kpiCard(
        "Tokens Generated",
        t ? fmt(t.successful, 0) : "—",
        t ? `of ${fmt(t.total_requested, 0)} requested, ${t.status}` : "not run yet",
        t ? "measured" : null
      ),
      kpiCard(
        "Traceability",
        tr ? fmt(tr.success_rate * 100, 1) + "%" : "—",
        tr ? `${fmt(tr.fully_traced, 0)} / ${fmt(tr.tokens_checked, 0)} tokens fully traced` : "run Benchmark 1 first",
        tr ? "measured" : null
      ),
      kpiCard("Average Latency", p ? fmt(p.latency.avg_ms, 1) + " ms" : "—", "pipeline, per transaction", p ? "measured" : null),
      kpiCard(
        "Throughput",
        p ? fmt(p.throughput_tps.value, 2) + " tx/s" : "—",
        p ? "pipeline benchmark" : "not run yet",
        p ? "measured" : null
      ),
      kpiCard(
        "Database Performance",
        db ? fmt(db.insert.latency.avg_ms, 1) + " ms" : "—",
        db ? "avg insert latency" : "not run yet",
        db ? "measured" : null
      ),
      kpiCard(
        "Infrastructure Cost",
        cost && cost.estimated_monthly_cost_usd ? "$" + fmt(cost.estimated_monthly_cost_usd.value, 2) + "/mo" : "—",
        cost && cost.captured ? "estimated from real usage" : "snapshot not captured yet",
        cost && cost.estimated_monthly_cost_usd ? "estimated" : null
      ),
      kpiCard(
        "Overall System Status",
        ready.length ? (overallOk ? "READY" : "ATTENTION") : "—",
        ready.length ? `${ready.filter((r) => r.ok).length}/${ready.length} checks pass` : "not checked yet",
        ready.length ? "measured" : null
      ),
    ];
    grid.innerHTML = cards.join("");
  }

  function renderCharts(report) {
    const p = report.pipeline;
    const t = report.tokens;

    // Latency distribution - reconstruct an approximate spread from stats (min/median/p95/p99/max)
    if (p) {
      const approx = [p.latency.min_ms, p.latency.median_ms, p.latency.median_ms, p.latency.p95_ms, p.latency.p99_ms, p.latency.max_ms];
      window.SaqrCharts.drawHistogram(document.getElementById("chart-latency-dist"), approx, { unit: "ms" });
    } else {
      window.SaqrCharts.drawHistogram(document.getElementById("chart-latency-dist"), []);
    }

    // Throughput over time - from token benchmark's tps_samples
    if (t && t.tps_samples && t.tps_samples.length) {
      window.SaqrCharts.drawLine(document.getElementById("chart-throughput-time"), t.tps_samples.map((s) => ({ x: s.t, y: s.tps })));
      window.SaqrCharts.drawLine(document.getElementById("chart-token-speed"), t.tps_samples.map((s) => ({ x: s.t, y: s.tps })));
    } else {
      window.SaqrCharts.drawLine(document.getElementById("chart-throughput-time"), []);
      window.SaqrCharts.drawLine(document.getElementById("chart-token-speed"), []);
    }

    // Stage execution time (avg ms per stage) + agent execution comparison (p95 ms per stage)
    if (p && p.per_stage_latency_ms) {
      const stages = Object.keys(p.per_stage_latency_ms);
      window.SaqrCharts.drawBar(
        document.getElementById("chart-stage-time"),
        stages.map((s) => ({ label: s.slice(0, 4), value: p.per_stage_latency_ms[s].avg_ms }))
      );
      window.SaqrCharts.drawBar(
        document.getElementById("chart-agent-comparison"),
        stages.map((s) => ({ label: s.slice(0, 4), value: p.per_stage_latency_ms[s].p95_ms }))
      );
    } else {
      window.SaqrCharts.drawBar(document.getElementById("chart-stage-time"), []);
      window.SaqrCharts.drawBar(document.getElementById("chart-agent-comparison"), []);
    }
  }

  function metricRow(label, value) {
    return `<div class="metric-row"><span class="metric-label">${label}</span><span class="metric-value">${value}</span></div>`;
  }

  function renderReliability(report) {
    const p = report.pipeline;
    const t = report.tokens;
    const rows = [
      metricRow("Successful transactions", p ? fmt(p.successful, 0) : "—"),
      metricRow("Success rate", p ? fmt(p.success_rate * 100, 1) + "%" : "—"),
      metricRow("Pipeline failures", p ? fmt(p.failed, 0) : "—"),
      metricRow("Token collisions", t ? fmt(t.duplicate_tokens, 0) : "—"),
      metricRow("Database failures", t ? fmt(t.database_failures, 0) : "—"),
      metricRow("Lost tokens", t ? `${fmt(t.lost_tokens_found, 0)} / ${fmt(t.lost_tokens_checked, 0)} sampled` : "—"),
      metricRow("Recovery errors", t ? fmt(t.recovery_errors, 0) : "—"),
    ];
    document.getElementById("reliability-list").innerHTML = rows.join("");
  }

  function renderPerformance(report) {
    const p = report.pipeline;
    const t = report.tokens;
    const db = report.database;
    const rows = [
      metricRow("Average latency (pipeline)", p ? fmt(p.latency.avg_ms, 1) + " ms" : "—"),
      metricRow("P95 latency (pipeline)", p ? fmt(p.latency.p95_ms, 1) + " ms" : "—"),
      metricRow("P99 latency (pipeline)", p ? fmt(p.latency.p99_ms, 1) + " ms" : "—"),
      metricRow("Avg token generation time", t ? fmt(t.avg_latency_ms.value, 1) + " ms" : "—"),
      metricRow("Avg DB insert time", db ? fmt(db.insert.latency.avg_ms, 1) + " ms" : "—"),
      metricRow("Avg DB lookup time", db ? fmt(db.lookup.latency.avg_ms, 1) + " ms" : "—"),
      metricRow("Throughput (TPS)", p ? fmt(p.throughput_tps.value, 2) + " tx/s" : "—"),
    ];
    document.getElementById("performance-list").innerHTML = rows.join("");
  }

  function renderReadiness(report) {
    const items = report.readiness || [];
    document.getElementById("readiness-grid").innerHTML = items
      .map(
        (item) => `
      <div class="readiness-item ${item.ok ? "ok" : "not-ok"}">
        <span class="readiness-icon">${item.ok ? "✓" : "✕"}</span>
        <div class="readiness-body">
          <div class="readiness-label">${item.label}</div>
          <div class="readiness-detail">${item.detail}</div>
          <div class="readiness-kind">${item.label_kind}</div>
        </div>
      </div>`
      )
      .join("");
  }

  function renderCost(report) {
    const cost = report.infra_cost;
    const summary = document.getElementById("cost-summary");
    if (!cost || !cost.captured) {
      summary.innerHTML = metricRow("Status", "Infrastructure snapshot not yet captured");
    } else {
      summary.innerHTML = [
        metricRow("Estimated monthly cost", "$" + fmt(cost.estimated_monthly_cost_usd.value, 2) + sourceBadge("estimated")),
        metricRow("Database size", fmt((cost.database_size_bytes || 0) / (1024 * 1024), 2) + " MB" + sourceBadge("measured")),
      ].join("");
    }
    const tbody = document.getElementById("compare-tbody");
    tbody.innerHTML = (cost && cost.comparison ? cost.comparison : [])
      .map(
        (row) => `<tr>
        <td>${row.label}</td>
        <td>${row.saqr_value} ${sourceBadge(row.saqr_source)}</td>
        <td>${row.traditional_value} ${sourceBadge(row.traditional_source)}</td>
        <td class="explanation">${row.explanation}</td>
      </tr>`
      )
      .join("");
  }

  function renderExecutiveReport(report) {
    const p = report.pipeline, t = report.tokens, tr = report.traceability, db = report.database, cost = report.infra_cost, ready = report.readiness || [];
    const block = document.getElementById("report-block");
    if (!p && !t) {
      block.innerHTML = '<p class="empty-note">Run the benchmarks above, then click "Refresh report".</p>';
      return;
    }
    const readyOk = ready.filter((r) => r.ok).length;
    block.innerHTML = `
      <h3>Environment</h3>
      <p>Generated ${new Date(report.generated_at).toLocaleString()}. 5-agent SAQR pipeline + dashboard, Dockerized, running against real Postgres/Neo4j/Kafka.</p>

      <h3>Dataset</h3>
      <p>${p ? `Benchmark 1 sampled ${fmt(p.sample_size, 0)} real transactions from a ${fmt(p.full_dataset_size, 0)}-transaction real dataset already in Postgres.` : "Pipeline benchmark not yet run."}
      ${t ? `Benchmark 2 generated ${fmt(t.total_requested, 0)} synthetic transactions across ${fmt(t.total_customers, 0)} synthetic customers.` : ""}</p>

      <h3>Execution &amp; Scalability</h3>
      <p>${p ? `Measured throughput: ${fmt(p.throughput_tps.value, 2)} tx/s. Projected full-dataset processing time: ${fmt(p.full_dataset_projected_seconds.value / 60, 1)} minutes (${sourceBadge("projected")}).` : "—"}
      ${t ? `Token generation measured at ${fmt(t.generation_rate_tps.value, 1)} tokens/sec.` : ""}</p>

      <h3>Reliability</h3>
      <p>${p ? `${fmt(p.success_rate * 100, 1)}% pipeline success rate (${fmt(p.successful, 0)}/${fmt(p.sample_size, 0)}).` : "—"}
      ${t ? `Token generation: ${fmt(t.duplicate_tokens, 0)} collisions, ${fmt(t.database_failures, 0)} database failures observed, ${fmt(t.lost_tokens_found, 0)}/${fmt(t.lost_tokens_checked, 0)} lost tokens on sampled verification.` : ""}</p>

      <h3>Traceability</h3>
      <p>${tr ? `${fmt(tr.success_rate * 100, 1)}% of tokens (${fmt(tr.fully_traced, 0)}/${fmt(tr.tokens_checked, 0)}) fully traced through all 5 agents.` : "Run Benchmark 1 to compute traceability."}</p>

      <h3>Infrastructure Efficiency</h3>
      <p>${cost && cost.captured ? `Estimated $${fmt(cost.estimated_monthly_cost_usd.value, 2)}/month (${sourceBadge("estimated")}) based on real captured CPU/RAM/storage usage.` : "Infrastructure snapshot not yet captured."}
      ${db ? `Database benchmark: ${fmt(db.insert.latency.avg_ms, 1)}ms avg insert, ${fmt(db.lookup.latency.avg_ms, 1)}ms avg lookup.` : ""}</p>

      <h3>Production Readiness</h3>
      <p>${readyOk}/${ready.length} checks pass. See the Production Readiness section above for the full, individually-labeled list.</p>
    `;
  }

  refreshReport();
})();
