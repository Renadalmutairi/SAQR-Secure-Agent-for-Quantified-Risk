/* Minimal hand-rolled Canvas chart primitives - histogram, line, bar. Functional and
 * on-brand, deliberately not polished further: per explicit direction, engineering
 * validation work takes priority over chart visuals here.
 */
window.SaqrCharts = (function () {
  function themeColors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      accent: (cs.getPropertyValue("--accent") || "#0D8F87").trim(),
      muted: (cs.getPropertyValue("--text-muted") || "#5B6478").trim(),
      border: (cs.getPropertyValue("--border") || "#DFE3EA").trim(),
    };
  }

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.clientWidth || 300;
    const height = rect.height || canvas.clientHeight || 180;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, width, height };
  }

  function drawEmpty(ctx, width, height, colors) {
    ctx.fillStyle = colors.muted;
    ctx.font = "12px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data yet - run this benchmark", width / 2, height / 2);
  }

  function drawHistogram(canvas, values, opts) {
    opts = opts || {};
    const { ctx, width, height } = setupCanvas(canvas);
    const colors = themeColors();
    ctx.clearRect(0, 0, width, height);
    if (!values || values.length === 0) {
      drawEmpty(ctx, width, height, colors);
      return;
    }
    const bins = opts.bins || 12;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const counts = new Array(bins).fill(0);
    values.forEach((v) => {
      let idx = Math.floor(((v - min) / range) * bins);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      counts[idx]++;
    });
    const maxCount = Math.max(...counts, 1);
    const padding = { top: 10, bottom: 20, left: 4, right: 4 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const barW = plotW / bins;
    counts.forEach((c, i) => {
      const barH = (c / maxCount) * plotH;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = colors.accent;
      ctx.fillRect(padding.left + i * barW + 1, padding.top + (plotH - barH), Math.max(barW - 2, 1), barH);
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.muted;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(min.toFixed(0) + (opts.unit || ""), padding.left, height - 4);
    ctx.textAlign = "right";
    ctx.fillText(max.toFixed(0) + (opts.unit || ""), width - padding.right, height - 4);
  }

  function drawLine(canvas, points) {
    const { ctx, width, height } = setupCanvas(canvas);
    const colors = themeColors();
    ctx.clearRect(0, 0, width, height);
    if (!points || points.length === 0) {
      drawEmpty(ctx, width, height, colors);
      return;
    }
    const padding = { top: 10, bottom: 20, left: 34, right: 10 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs) || 1;
    const yMax = Math.max(...ys, 1);

    function px(x) {
      return padding.left + ((x - xMin) / (xMax - xMin || 1)) * plotW;
    }
    function py(y) {
      return padding.top + plotH - (y / yMax) * plotH;
    }

    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH);
    ctx.lineTo(padding.left + plotW, padding.top + plotH);
    ctx.stroke();

    ctx.beginPath();
    points.forEach((p, i) => {
      const x = px(p.x);
      const y = py(p.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineTo(px(xs[xs.length - 1]), padding.top + plotH);
    ctx.lineTo(px(xs[0]), padding.top + plotH);
    ctx.closePath();
    ctx.fillStyle = colors.accent + "22";
    ctx.fill();

    const last = points[points.length - 1];
    ctx.beginPath();
    ctx.arc(px(last.x), py(last.y), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = colors.accent;
    ctx.fill();

    ctx.fillStyle = colors.muted;
    ctx.font = "10px ui-monospace, monospace";
    ctx.textAlign = "left";
    ctx.fillText(yMax.toFixed(0), 2, padding.top + 8);
    ctx.fillText("0", 2, padding.top + plotH);
  }

  function drawBar(canvas, items) {
    const { ctx, width, height } = setupCanvas(canvas);
    const colors = themeColors();
    ctx.clearRect(0, 0, width, height);
    if (!items || items.length === 0) {
      drawEmpty(ctx, width, height, colors);
      return;
    }
    const padding = { top: 16, bottom: 24, left: 6, right: 6 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const maxVal = Math.max(...items.map((d) => d.value), 1);
    const gap = 10;
    const barW = (plotW - gap * (items.length - 1)) / items.length;

    items.forEach((d, i) => {
      const barH = (d.value / maxVal) * plotH;
      const x = padding.left + i * (barW + gap);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = colors.accent;
      ctx.fillRect(x, padding.top + (plotH - barH), barW, barH);
      ctx.globalAlpha = 1;
      ctx.fillStyle = colors.muted;
      ctx.font = "10px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(d.label, x + barW / 2, height - 8);
      ctx.fillText(d.value.toFixed(0), x + barW / 2, padding.top + (plotH - barH) - 4);
    });
  }

  return { drawHistogram, drawLine, drawBar };
})();
