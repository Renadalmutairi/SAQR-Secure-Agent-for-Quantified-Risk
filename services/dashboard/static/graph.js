/* Hand-rolled Canvas force-directed graph - no external library. Built to scale to more
 * nodes without rework (see the dashboard build plan): today Agent 2 only exposes
 * per-account stats and a specific-pair relationship lookup, so this typically renders
 * exactly the transaction's sender and receiver, with the real edge metrics between them
 * when one already exists. Every value drawn comes from data.nodes/data.edges - nothing
 * here is synthesized.
 */
window.SaqrGraph = (function () {
  function render(canvas, data) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let width = 0;
    let height = 0;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    const nodes = data.nodes.map((n, i) => ({
      ...n,
      x: width / 2 + (i === 0 ? -90 : 90) + (Math.random() - 0.5) * 24,
      y: height / 2 + (Math.random() - 0.5) * 24,
      vx: 0,
      vy: 0,
    }));
    const edges = data.edges.map((e) => ({
      ...e,
      sourceNode: nodes.find((n) => n.id === e.source),
      targetNode: nodes.find((n) => n.id === e.target),
    }));

    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let dragging = false;
    let dragStart = null;
    let hoveredNode = null;

    const styles = getComputedStyle(document.documentElement);
    const accent = (styles.getPropertyValue("--accent") || "#0D8F87").trim();
    const textMuted = (styles.getPropertyValue("--text-muted") || "#5B6478").trim();
    const surfaceSolid = (styles.getPropertyValue("--surface-solid") || "#FFFFFF").trim();

    function nodeRadius(n) {
      return 22 + Math.min(n.degree || 0, 10) * 1.5;
    }

    function simulate() {
      const repulsion = 4200;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distSq = Math.max(dx * dx + dy * dy, 100);
          const force = repulsion / distSq;
          const dist = Math.sqrt(distSq);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }
      edges.forEach((e) => {
        const a = e.sourceNode;
        const b = e.targetNode;
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 170) * 0.02;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      });
      nodes.forEach((n) => {
        n.vx += (width / 2 - n.x) * 0.0012;
        n.vy += (height / 2 - n.y) * 0.0012;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
      });
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(panX, panY);
      ctx.scale(zoom, zoom);

      edges.forEach((e) => {
        const a = e.sourceNode;
        const b = e.targetNode;
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;

        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.fillStyle = textMuted;
        ctx.font = "10px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(`trust ${e.structural_trust_score.toFixed(2)}`, mx, my - 6);
      });

      nodes.forEach((n) => {
        const radius = nodeRadius(n);
        const isHovered = hoveredNode === n;
        const isSender = n.role === "sender";

        if (isSender) {
          const glow = ctx.createRadialGradient(n.x, n.y, radius * 0.3, n.x, n.y, radius * 2.3);
          glow.addColorStop(0, accent + "55");
          glow.addColorStop(1, accent + "00");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius * 2.3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = surfaceSolid;
        ctx.fill();
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.strokeStyle = accent;
        ctx.stroke();

        ctx.fillStyle = textMuted;
        ctx.font = "600 11px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.fillText(n.id, n.x, n.y + 4);
      });

      ctx.restore();
    }

    let raf = null;
    function tick() {
      simulate();
      draw();
      raf = requestAnimationFrame(tick);
    }
    tick();

    function toWorld(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return { x: (clientX - rect.left - panX) / zoom, y: (clientY - rect.top - panY) / zoom };
    }

    function nodeAt(x, y) {
      return nodes.find((n) => {
        const r = nodeRadius(n);
        const dx = n.x - x;
        const dy = n.y - y;
        return dx * dx + dy * dy <= r * r;
      });
    }

    const tooltip = document.getElementById("graph-tooltip");

    function onMouseDown(e) {
      dragging = true;
      dragStart = { x: e.clientX - panX, y: e.clientY - panY };
    }
    function onMouseUp() {
      dragging = false;
    }
    function onMouseMove(e) {
      if (dragging) {
        panX = e.clientX - dragStart.x;
        panY = e.clientY - dragStart.y;
        return;
      }
      const world = toWorld(e.clientX, e.clientY);
      const node = nodeAt(world.x, world.y);
      hoveredNode = node || null;
      canvas.style.cursor = node ? "pointer" : "grab";
      if (node && tooltip) {
        tooltip.hidden = false;
        const rect = canvas.parentElement.getBoundingClientRect();
        tooltip.style.left = e.clientX - rect.left + 12 + "px";
        tooltip.style.top = e.clientY - rect.top + 12 + "px";
        tooltip.innerHTML = `<strong>${node.role === "sender" ? "Sender" : "Receiver"} · ${node.id}</strong><br/>
          degree ${node.degree} · fan-in ${node.fan_in} · fan-out ${node.fan_out}<br/>
          community ${node.community_id ?? "—"} · complexity ${(node.structural_complexity_score || 0).toFixed(2)}`;
      } else if (tooltip) {
        tooltip.hidden = true;
      }
    }
    function onMouseLeave() {
      if (tooltip) tooltip.hidden = true;
    }
    function onWheel(e) {
      e.preventDefault();
      zoom = Math.min(Math.max(zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.5), 2.5);
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    const zoomInBtn = document.getElementById("graph-zoom-in");
    const zoomOutBtn = document.getElementById("graph-zoom-out");
    const onZoomIn = () => {
      zoom = Math.min(zoom * 1.2, 2.5);
    };
    const onZoomOut = () => {
      zoom = Math.max(zoom * 0.8, 0.5);
    };
    if (zoomInBtn) zoomInBtn.addEventListener("click", onZoomIn);
    if (zoomOutBtn) zoomOutBtn.addEventListener("click", onZoomOut);

    return {
      destroy() {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        window.removeEventListener("mouseup", onMouseUp);
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mouseleave", onMouseLeave);
        canvas.removeEventListener("wheel", onWheel);
        if (zoomInBtn) zoomInBtn.removeEventListener("click", onZoomIn);
        if (zoomOutBtn) zoomOutBtn.removeEventListener("click", onZoomOut);
        if (tooltip) tooltip.hidden = true;
      },
    };
  }

  return { render };
})();
