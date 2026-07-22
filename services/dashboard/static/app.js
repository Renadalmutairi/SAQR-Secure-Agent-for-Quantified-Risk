(function () {
  "use strict";
  const API = "";

  // ---------------- theme ----------------
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
  });

  // ---------------- toasts ----------------
  function toast(message, type) {
    const stack = document.getElementById("toast-stack");
    const el = document.createElement("div");
    el.className = "toast" + (type ? " " + type : "");
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------- database status polling (real, never faked) ----------------
  const dbIndicator = document.getElementById("db-indicator");
  const generateBtn = document.getElementById("generate-btn");
  let formInFlight = false;

  async function pollDbStatus() {
    try {
      const res = await fetch(`${API}/api/db-status`);
      const data = await res.json();
      const online = data.database === "online";
      dbIndicator.dataset.state = online ? "online" : "offline";
      generateBtn.disabled = !online || formInFlight;
    } catch (e) {
      dbIndicator.dataset.state = "offline";
      generateBtn.disabled = true;
    }
  }
  pollDbStatus();
  setInterval(pollDbStatus, 3000);

  // ---------------- sample transaction ----------------
  document.getElementById("load-sample").addEventListener("click", () => {
    document.getElementById("f-account").value = "959";
    document.getElementById("f-receiver").value = "450";
    document.getElementById("f-amount").value = "406.85";
    document.getElementById("f-type").value = "TRANSFER";
  });

  // ---------------- agent status pills ----------------
  function setAgentPill(stage, state) {
    const pill = document.querySelector(`.agent-pill[data-agent="${stage}"]`);
    if (pill) pill.dataset.state = state;
  }
  function resetAgentPills() {
    document.querySelectorAll(".agent-pill").forEach((p) => delete p.dataset.state);
  }

  // ---------------- checklist ----------------
  const checklistOrder = ["generated", "stored", "behavioral", "graph", "trust", "compliance", "decision"];
  const checklistEl = document.getElementById("checklist");
  function resetChecklist() {
    checklistEl.hidden = false;
    checklistOrder.forEach((key) => {
      const item = checklistEl.querySelector(`[data-key="${key}"]`);
      if (item) item.classList.remove("active", "done", "failed");
    });
  }
  function markChecklist(key, state) {
    const item = checklistEl.querySelector(`[data-key="${key}"]`);
    if (item) {
      item.classList.remove("active", "done", "failed");
      item.classList.add(state);
    }
  }

  // ---------------- decision badge helper ----------------
  function decisionBadgeClass(decision) {
    switch (decision) {
      case "APPROVE":
        return "approve";
      case "REVIEW":
        return "review";
      case "ESCALATE":
        return "escalate";
      case "REJECT":
        return "reject";
      default:
        return "pending";
    }
  }

  // ---------------- recent tokens table ----------------
  const recentTbody = document.getElementById("recent-tbody");
  const recentTokens = [];

  function renderRecent() {
    if (recentTokens.length === 0) {
      recentTbody.innerHTML = '<tr class="empty-row"><td colspan="6">No tokens generated yet this session.</td></tr>';
      return;
    }
    recentTbody.innerHTML = recentTokens
      .slice()
      .reverse()
      .map(
        (t) => `
      <tr>
        <td class="token-cell" data-token="${t.token}">${t.token}</td>
        <td>${t.account_id} &rarr; ${t.receiver_account_id}</td>
        <td>${t.amount.toFixed(2)} SAR</td>
        <td><span class="status-badge ${t.failed ? "failed" : t.done ? "approve" : "running"}">${
          t.failed ? "Failed" : t.done ? "Completed" : "Running"
        }</span></td>
        <td>${t.decision ? `<span class="status-badge ${decisionBadgeClass(t.decision)}">${t.decision}</span>` : "&mdash;"}</td>
        <td class="mono">${new Date(t.created_at).toLocaleTimeString()}</td>
      </tr>`
      )
      .join("");
    recentTbody.querySelectorAll(".token-cell").forEach((cell) => {
      cell.addEventListener("click", () => openTokenDetail(cell.dataset.token));
    });
  }

  // ---------------- form submit / demo run ----------------
  const form = document.getElementById("tx-form");
  const tokenReveal = document.getElementById("token-reveal");
  const tokenChip = document.getElementById("token-chip");
  const tokenChipValue = document.getElementById("token-chip-value");
  const tokenRevealMeta = document.getElementById("token-reveal-meta");
  const tokenRevealDecision = document.getElementById("token-reveal-decision");
  let currentToken = null;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (formInFlight) return;
    formInFlight = true;
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating…";
    resetChecklist();
    resetAgentPills();
    tokenReveal.hidden = true;
    tokenRevealDecision.textContent = "";
    tokenRevealDecision.className = "token-reveal-decision";

    const payload = {
      account_id: document.getElementById("f-account").value.trim(),
      receiver_account_id: document.getElementById("f-receiver").value.trim(),
      amount: parseFloat(document.getElementById("f-amount").value),
      tx_type: document.getElementById("f-type").value,
    };

    const recordEntry = {
      token: null,
      account_id: payload.account_id,
      receiver_account_id: payload.receiver_account_id,
      amount: payload.amount,
      created_at: new Date().toISOString(),
      done: false,
      failed: false,
      decision: null,
    };

    try {
      const res = await fetch(`${API}/api/demo/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();

      currentToken = result.token;
      recordEntry.token = result.token;

      markChecklist("generated", "done");
      markChecklist("stored", "done");
      tokenChipValue.textContent = result.token;
      tokenReveal.hidden = false;
      tokenRevealMeta.textContent = `${payload.account_id} → ${payload.receiver_account_id} · ${payload.amount.toFixed(2)} SAR`;

      for (const stage of checklistOrder.slice(2)) {
        markChecklist(stage, "active");
        setAgentPill(stage, "running");
        break; // only the first pending stage should show "active" until results arrive below
      }

      for (const stageResult of result.stages) {
        markChecklist(stageResult.stage, stageResult.status === "completed" ? "done" : "failed");
        setAgentPill(stageResult.stage, stageResult.status === "completed" ? "completed" : "failed");
        if (stageResult.status === "failed") {
          toast(`${stageResult.stage} failed: ${stageResult.error || "unknown error"}`, "error");
        }
      }

      recordEntry.failed = result.failed;
      recordEntry.done = !result.failed;
      const decisionStage = result.stages.find((s) => s.stage === "decision");
      if (decisionStage && decisionStage.status === "completed" && decisionStage.result) {
        recordEntry.decision = decisionStage.result.decision;
        tokenRevealDecision.textContent = decisionStage.result.decision;
        tokenRevealDecision.className = "token-reveal-decision status-badge " + decisionBadgeClass(decisionStage.result.decision);
      }

      if (!result.failed) toast("Pipeline completed — decision reached.", "success");
    } catch (err) {
      toast(`Token generation failed: ${err.message}`, "error");
    } finally {
      recentTokens.push(recordEntry);
      renderRecent();
      formInFlight = false;
      generateBtn.textContent = "Generate Token";
      pollDbStatus();
    }
  });

  tokenChip.addEventListener("click", () => {
    if (currentToken) openTokenDetail(currentToken);
  });

  // ---------------- token detail overlay ----------------
  const overlay = document.getElementById("detail-overlay");
  const detailToken = document.getElementById("detail-token");
  const detailTransaction = document.getElementById("detail-transaction");
  const detailTimeline = document.getElementById("detail-timeline");
  const evidenceTabs = document.getElementById("evidence-tabs");
  const evidencePanels = document.getElementById("evidence-panels");
  const graphCaption = document.querySelector(".graph-caption");
  let graphInstance = null;

  document.getElementById("detail-close").addEventListener("click", closeDetail);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeDetail();
  });

  function closeDetail() {
    overlay.hidden = true;
    if (graphInstance) {
      graphInstance.destroy();
      graphInstance = null;
    }
  }

  const STAGE_LABELS = {
    behavioral: "Behavioral DNA",
    graph: "Graph Intelligence",
    trust: "Trust Intelligence",
    compliance: "Compliance",
    decision: "Decision",
  };

  async function openTokenDetail(token) {
    overlay.hidden = false;
    detailToken.textContent = token;
    detailTransaction.innerHTML = "";
    detailTimeline.innerHTML = "";
    evidenceTabs.innerHTML = "";
    evidencePanels.innerHTML = "";
    if (graphCaption) graphCaption.textContent = "Sender ↔ receiver relationship, from Agent 2's live graph store.";

    try {
      const [tokenRes, timelineRes] = await Promise.all([
        fetch(`${API}/api/tokens/${token}`),
        fetch(`${API}/api/tokens/${token}/timeline`),
      ]);
      if (!tokenRes.ok) throw new Error("token not found");
      const detail = await tokenRes.json();
      const timeline = await timelineRes.json();

      renderTransaction(detail.registry);
      renderTimeline(timeline);
      renderEvidence(detail.stage_results);
      loadGraph(token);
    } catch (err) {
      toast(`Could not load token details: ${err.message}`, "error");
    }
  }

  function renderTransaction(registry) {
    const fields = [
      ["Customer", registry.customer_id],
      ["Sender account", registry.account_id],
      ["Receiver account", registry.receiver_account_id],
      ["Amount", `${registry.amount.toFixed(2)} SAR`],
      ["Type", registry.transaction_type],
      ["Created", new Date(registry.created_at).toLocaleString()],
    ];
    detailTransaction.innerHTML = fields.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(String(v))}</dd></div>`).join("");
  }

  function renderTimeline(events) {
    detailTimeline.innerHTML = events
      .map(
        (e, i) => `
      <li class="timeline-item">
        <span class="timeline-dot${/Failed/.test(e.event) ? " fail" : ""}" style="animation-delay:${i * 60}ms"></span>
        <div>
          <div class="timeline-event">${escapeHtml(e.event)}</div>
          ${e.detail ? `<div class="timeline-detail">${escapeHtml(e.detail)}</div>` : ""}
          <div class="timeline-time">${new Date(e.occurred_at).toLocaleTimeString()}</div>
        </div>
      </li>`
      )
      .join("");
  }

  function renderEvidence(stageResults) {
    const byStage = {};
    stageResults.forEach((r) => {
      byStage[r.stage] = r;
    });
    const stages = ["behavioral", "graph", "trust", "compliance", "decision"];

    evidenceTabs.innerHTML = stages
      .map((s, i) => `<button type="button" class="evidence-tab${i === 0 ? " active" : ""}" data-stage="${s}">${STAGE_LABELS[s]}</button>`)
      .join("");
    evidencePanels.innerHTML = stages
      .map((s, i) => {
        const r = byStage[s];
        const body = r && r.result ? `<pre>${escapeHtml(JSON.stringify(r.result, null, 2))}</pre>` : `<div class="evidence-empty">No result recorded for this stage yet.</div>`;
        return `<div class="evidence-panel${i === 0 ? " active" : ""}" data-stage="${s}">${body}</div>`;
      })
      .join("");

    evidenceTabs.querySelectorAll(".evidence-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        evidenceTabs.querySelectorAll(".evidence-tab").forEach((t) => t.classList.remove("active"));
        evidencePanels.querySelectorAll(".evidence-panel").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const panel = evidencePanels.querySelector(`[data-stage="${tab.dataset.stage}"]`);
        if (panel) panel.classList.add("active");
      });
    });
  }

  async function loadGraph(token) {
    if (graphInstance) {
      graphInstance.destroy();
      graphInstance = null;
    }
    try {
      const res = await fetch(`${API}/api/graph/${token}`);
      if (!res.ok) throw new Error("graph fetch failed");
      const data = await res.json();
      graphInstance = window.SaqrGraph.render(document.getElementById("graph-canvas"), data);
    } catch (err) {
      if (graphCaption) graphCaption.textContent = "Relationship data unavailable for this token.";
    }
  }

  // ---------------- initial state ----------------
  resetAgentPills();
  renderRecent();
})();
