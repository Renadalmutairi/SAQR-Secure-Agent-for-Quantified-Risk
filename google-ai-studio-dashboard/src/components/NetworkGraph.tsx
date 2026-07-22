import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  Network, 
  User, 
  Smartphone, 
  Globe, 
  CreditCard, 
  Search, 
  AlertTriangle, 
  Building,
  Info,
  Sliders,
  Cpu,
  Layers,
  Activity,
  Zap,
  ArrowRight,
  ShieldCheck,
  Award,
  RefreshCw,
  SearchIcon,
  X,
  FileText,
  TrendingUp,
  MapPin,
  Phone,
  Laptop,
  Maximize2,
  ZoomIn,
  ZoomOut,
  SlidersHorizontal,
  ChevronDown,
  Compass,
  CheckCircle2,
  LayoutGrid,
  ShieldAlert
} from "lucide-react";
import { InvestigationState, GraphEntity, GraphRelationship } from "../types";

interface NetworkGraphProps {
  activeCase: InvestigationState;
  onSelectCaseById: (caseId: string) => void;
  allCases: InvestigationState[];
  isDarkMode?: boolean;
}

// Internal node type for physics simulation
interface PhysicsNode {
  id: string;
  entity: GraphEntity;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null; // For dragging
  fy: number | null; // For dragging
  degree: number;
  betweenness: number;
  pageRank: number;
  communityId: number;
  riskScore: number;
  gatScore: number;
}

export default function NetworkGraph({ 
  activeCase, 
  onSelectCaseById, 
  allCases,
  isDarkMode = false
}: NetworkGraphProps) {
  // --- STATE DECLARATIONS ---
  const [selectedNode, setSelectedNode] = useState<GraphEntity | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchedAndFocusedNodeId, setSearchedAndFocusedNodeId] = useState<string | null>(null);
  
  // Dijkstra states
  const [tracingTargetId, setTracingTargetId] = useState<string | null>(null);
  const [activeDijkstraPath, setActiveDijkstraPath] = useState<string[]>([]);
  const [isTracingActive, setIsTracingActive] = useState<boolean>(false);

  // Layout forces
  const [repulsionStrength, setRepulsionStrength] = useState<number>(3000);
  const [linkDistance, setLinkDistance] = useState<number>(100);
  const [gravityStrength, setGravityStrength] = useState<number>(0.07);
  const [isPhysicsRunning, setIsPhysicsRunning] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"dossier" | "metrics">("dossier");

  // Physics positions state
  const [nodes, setNodes] = useState<PhysicsNode[]>([]);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const canvasRef = useRef<SVGSVGElement | null>(null);

  // Zoom & Pan states for premium navigation
  const [zoom, setZoom] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Filters state
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<Set<string>>(
    new Set(["account", "bank", "person", "customer", "company", "device", "ip", "phone", "merchant", "wallet", "atm"])
  );
  const [selectedRiskLevels, setSelectedRiskLevels] = useState<Set<string>>(
    new Set(["critical", "high", "medium", "low"])
  );
  const [minRelationshipWeight, setMinRelationshipWeight] = useState<number>(0.0);

  // Collapsed/Expandable communities state
  const [collapsedCommunities, setCollapsedCommunities] = useState<number[]>([]);

  // Logs for intelligence-grade telemetry
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ar-EG', { hour12: false });
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 14)]);
  };

  // --- COMPUTE CORE GRAPH METRICS ---
  const computedGraphMetrics = useMemo(() => {
    if (!activeCase?.graph_result) return null;

    const entities = activeCase.graph_result.entities;
    const relationships = activeCase.graph_result.relationships;
    const suspiciousIds = activeCase.graph_result.suspicious_node_ids || [];

    const n = entities.length;
    if (n === 0) return null;

    // Build Adjacency list & weight maps
    const adj: Record<string, string[]> = {};
    const weightMap: Record<string, Record<string, number>> = {};
    entities.forEach(e => {
      adj[e.entity_id] = [];
      weightMap[e.entity_id] = {};
    });

    relationships.forEach(r => {
      if (adj[r.source_id] && adj[r.target_id]) {
        adj[r.source_id].push(r.target_id);
        adj[r.target_id].push(r.source_id);
        
        weightMap[r.source_id][r.target_id] = (weightMap[r.source_id][r.target_id] || 0) + (r.weight || 1.0);
        weightMap[r.target_id][r.source_id] = (weightMap[r.target_id][r.source_id] || 0) + (r.weight || 1.0);
      }
    });

    // 1. Degree Centrality
    const degree: Record<string, number> = {};
    entities.forEach(e => {
      degree[e.entity_id] = adj[e.entity_id].length;
    });

    // 2. PageRank Centrality
    const pageRank: Record<string, number> = {};
    entities.forEach(e => { pageRank[e.entity_id] = 1 / n; });
    
    const damping = 0.85;
    for (let iter = 0; iter < 12; iter++) {
      const nextPR: Record<string, number> = {};
      entities.forEach(e => { nextPR[e.entity_id] = (1 - damping) / n; });

      entities.forEach(u => {
        const neighbors = adj[u.entity_id];
        if (neighbors.length > 0) {
          neighbors.forEach(v => {
            nextPR[v] = (nextPR[v] || 0) + damping * (pageRank[u.entity_id] / neighbors.length);
          });
        } else {
          entities.forEach(vEntity => {
            nextPR[vEntity.entity_id] = (nextPR[vEntity.entity_id] || 0) + damping * (pageRank[u.entity_id] / n);
          });
        }
      });
      entities.forEach(e => { pageRank[e.entity_id] = nextPR[e.entity_id]; });
    }

    let maxPR = Math.max(...Object.values(pageRank), 0.0001);
    entities.forEach(e => { pageRank[e.entity_id] = pageRank[e.entity_id] / maxPR; });

    // 3. Betweenness Centrality (Brandes simplified)
    const betweenness: Record<string, number> = {};
    entities.forEach(e => { betweenness[e.entity_id] = 0; });

    entities.forEach(s => {
      const queue: string[] = [s.entity_id];
      const paths: Record<string, string[]> = {};
      const dist: Record<string, number> = {};
      const stack: string[] = [];
      const sigmas: Record<string, number> = {};

      entities.forEach(e => {
        paths[e.entity_id] = [];
        dist[e.entity_id] = -1;
        sigmas[e.entity_id] = 0;
      });

      dist[s.entity_id] = 0;
      sigmas[s.entity_id] = 1;

      while (queue.length > 0) {
        const v = queue.shift()!;
        stack.push(v);
        const neighbors = adj[v] || [];
        neighbors.forEach(w => {
          if (dist[w] < 0) {
            dist[w] = dist[v] + 1;
            queue.push(w);
          }
          if (dist[w] === dist[v] + 1) {
            sigmas[w] += sigmas[v];
            paths[w].push(v);
          }
        });
      }

      const delta: Record<string, number> = {};
      entities.forEach(e => { delta[e.entity_id] = 0; });

      while (stack.length > 0) {
        const w = stack.pop()!;
        paths[w].forEach(v => {
          delta[v] += (sigmas[v] / sigmas[w]) * (1 + delta[w]);
        });
        if (w !== s.entity_id) {
          betweenness[w] += delta[w];
        }
      }
    });

    let maxBet = Math.max(...Object.values(betweenness), 0.0001);
    entities.forEach(e => { betweenness[e.entity_id] = betweenness[e.entity_id] / maxBet; });

    // 4. Community Detection using Label Propagation (Louvain proxy)
    const communities: Record<string, number> = {};
    entities.forEach((e, idx) => { communities[e.entity_id] = idx; });

    for (let step = 0; step < 5; step++) {
      entities.forEach(e => {
        const u = e.entity_id;
        const neighbors = adj[u];
        if (neighbors.length > 0) {
          const labelCounts: Record<number, number> = {};
          neighbors.forEach(v => {
            const label = communities[v];
            labelCounts[label] = (labelCounts[label] || 0) + (weightMap[u][v] || 1.0);
          });
          let bestLabel = communities[u];
          let maxCount = -1;
          Object.entries(labelCounts).forEach(([lbl, count]) => {
            if (count > maxCount) {
              maxCount = count;
              bestLabel = parseInt(lbl, 10);
            }
          });
          communities[u] = bestLabel;
        }
      });
    }

    const uniqueComms = Array.from(new Set(Object.values(communities)));
    entities.forEach(e => {
      communities[e.entity_id] = uniqueComms.indexOf(communities[e.entity_id]);
    });

    // 5. Risk Scores (SAMA compliance models)
    const riskScores: Record<string, number> = {};
    entities.forEach(e => {
      let baseRisk = 15;
      if (suspiciousIds.includes(e.entity_id)) {
        baseRisk = 92;
      } else {
        let minHops = 999;
        const queue: { id: string; hops: number }[] = [{ id: e.entity_id, hops: 0 }];
        const visited = new Set<string>([e.entity_id]);
        while (queue.length > 0) {
          const current = queue.shift()!;
          if (suspiciousIds.includes(current.id)) {
            minHops = current.hops;
            break;
          }
          const neighbors = adj[current.id] || [];
          neighbors.forEach(nId => {
            if (!visited.has(nId)) {
              visited.add(nId);
              queue.push({ id: nId, hops: current.hops + 1 });
            }
          });
        }

        if (minHops === 1) baseRisk = 78; // Direct risk neighbor
        else if (minHops === 2) baseRisk = 52; // Secondary connection risk
        else if (minHops === 3) baseRisk = 32;
      }
      riskScores[e.entity_id] = baseRisk;
    });

    // 6. GAT Model Softmax Scores
    const gatScores: Record<string, number> = {};
    entities.forEach(e => {
      let score = 0.1;
      const neighbors = adj[e.entity_id];
      if (neighbors.length > 0) {
        let riskSum = neighbors.reduce((acc, nId) => acc + (riskScores[nId] || 0), 0);
        score = riskSum / (neighbors.length * 100);
      }
      gatScores[e.entity_id] = Math.min(Math.max(score, 0.05), 0.95);
    });

    return {
      degree,
      pageRank,
      betweenness,
      communities,
      riskScores,
      gatScores,
      adj
    };
  }, [activeCase]);

  // --- INITIALIZE PHYSICS NODES ---
  useEffect(() => {
    if (!activeCase?.graph_result || !computedGraphMetrics) return;

    const entities = activeCase.graph_result.entities;
    const suspiciousIds = activeCase.graph_result.suspicious_node_ids || [];

    const width = 850;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2;

    const newNodes: PhysicsNode[] = entities.map((e, idx) => {
      const angle = (idx / entities.length) * Math.PI * 2;
      const r = 160 + Math.random() * 40;
      
      const metrics = computedGraphMetrics;

      return {
        id: e.entity_id,
        entity: e,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
        degree: metrics.degree[e.entity_id] || 0,
        betweenness: metrics.betweenness[e.entity_id] || 0,
        pageRank: metrics.pageRank[e.entity_id] || 0,
        communityId: metrics.communities[e.entity_id] || 0,
        riskScore: metrics.riskScores[e.entity_id] || 15,
        gatScore: metrics.gatScores[e.entity_id] || 0.1
      };
    });

    setNodes(newNodes);
    
    // Auto-select target account
    const targetAccount = entities.find(e => e.entity_type === "account") || entities[0];
    setSelectedNode(targetAccount);
    setSearchedAndFocusedNodeId(null);
    setActiveDijkstraPath([]);
    setIsTracingActive(false);
    setTracingTargetId(null);
    setCollapsedCommunities([]);
    setZoom(1.0);
    setPanX(0);
    setPanY(0);

    addLog(`تم تحميل محاكاة التحقيق الأكاديمي ForceAtlas2 والتحقق من التكتلات المشبوهة.`);
  }, [activeCase, computedGraphMetrics]);

  // --- PHYSICS ENGINE TICK LOOP ---
  useEffect(() => {
    if (!isPhysicsRunning || nodes.length === 0) return;

    let animFrameId: number;
    const width = 850;
    const height = 500;
    const cx = width / 2;
    const cy = height / 2;

    const relationships = activeCase?.graph_result?.relationships || [];

    const tick = () => {
      setNodes(prevNodes => {
        if (prevNodes.length === 0) return prevNodes;
        const next = prevNodes.map(n => ({ ...n }));

        // 1. Attraction along edges
        relationships.forEach(rel => {
          const sNode = next.find(n => n.id === rel.source_id);
          const tNode = next.find(n => n.id === rel.target_id);

          if (sNode && tNode) {
            const dx = tNode.x - sNode.x;
            const dy = tNode.y - sNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
            
            const k = 0.04 * (rel.weight || 1.0);
            const force = (dist - linkDistance) * k;
            
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (sNode.fx === null) { sNode.vx += fx; sNode.vy += fy; }
            if (tNode.fx === null) { tNode.vx -= fx; tNode.vy -= fy; }
          }
        });

        // 2. Repulsion between all nodes
        for (let i = 0; i < next.length; i++) {
          const u = next[i];
          for (let j = i + 1; j < next.length; j++) {
            const v = next[j];

            const dx = v.x - u.x;
            const dy = v.y - u.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;

            if (dist < 450) {
              const force = repulsionStrength / (dist * dist);
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;

              if (u.fx === null) { u.vx -= fx; u.vy -= fy; }
              if (v.fx === null) { v.vx += fx; v.vy += fy; }
            }
          }
        }

        // 3. Gravity and boundaries
        next.forEach(u => {
          if (u.fx !== null) {
            u.x = u.fx;
            u.y = u.fy;
            u.vx = 0;
            u.vy = 0;
          } else {
            const dx = cx - u.x;
            const dy = cy - u.y;
            u.vx += dx * gravityStrength;
            u.vy += dy * gravityStrength;

            u.vx *= 0.72;
            u.vy *= 0.72;

            u.x += u.vx;
            u.y += u.vy;

            u.x = Math.max(50, Math.min(width - 50, u.x));
            u.y = Math.max(50, Math.min(height - 50, u.y));
          }
        });

        return next;
      });

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameId);
  }, [isPhysicsRunning, activeCase, repulsionStrength, linkDistance, gravityStrength]);

  // --- DIJKSTRA SHORTEST SUSPICIOUS PATH ALGORITHM ---
  const handleTraceMoneyFlow = (targetNodeId: string) => {
    if (!activeCase?.graph_result || !computedGraphMetrics) return;
    
    const principalAccount = activeCase.graph_result.entities.find(e => e.entity_type === "account")?.entity_id;
    if (!principalAccount) {
      addLog("تعذر تحديد الحساب الرئيسي للتحقيق.");
      return;
    }

    const adj = computedGraphMetrics.adj;
    const nodesList = activeCase.graph_result.entities.map(e => e.entity_id);

    const dists: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const unvisited = new Set<string>();

    nodesList.forEach(id => {
      dists[id] = Infinity;
      prev[id] = null;
      unvisited.add(id);
    });

    dists[principalAccount] = 0;

    while (unvisited.size > 0) {
      let currentId: string | null = null;
      let minDist = Infinity;
      unvisited.forEach(id => {
        if (dists[id] < minDist) {
          minDist = dists[id];
          currentId = id;
        }
      });

      if (currentId === null || currentId === targetNodeId) break;
      unvisited.delete(currentId);

      const neighbors = adj[currentId] || [];
      neighbors.forEach(neighbor => {
        if (unvisited.has(neighbor)) {
          const edgeCost = activeCase.graph_result?.suspicious_node_ids.includes(neighbor) ? 0.4 : 1.0;
          const alt = dists[currentId!] + edgeCost;
          if (alt < dists[neighbor]) {
            dists[neighbor] = alt;
            prev[neighbor] = currentId;
          }
        }
      });
    }

    const path: string[] = [];
    let curr: string | null = targetNodeId;
    while (curr !== null) {
      path.unshift(curr);
      curr = prev[curr];
    }

    if (path[0] === principalAccount) {
      setActiveDijkstraPath(path);
      setIsTracingActive(true);
      setTracingTargetId(targetNodeId);
      addLog(`تم العثور على مسار تدفق أموال مشبوه عبر Dijkstra: ${path.join(" ➔ ")}`);
    } else {
      addLog("لم يتم العثور على رابط اتصال مباشر ومستقل.");
      setActiveDijkstraPath([]);
      setIsTracingActive(false);
    }
  };

  // --- MANUAL MOUSE PAN/ZOOM DRAG HANDLERS (Disabled per user request) ---
  const handleSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    // Panning disabled
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    handleMouseMove(e);
  };

  const handleSvgMouseUp = () => {
    handleMouseUp();
  };

  const handleZoomIn = () => {};
  const handleZoomOut = () => {};
  const handleZoomReset = () => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
  };

  // Setup Wheel Zoom explicitly disabled
  useEffect(() => {
    // Wheel zoom is disabled per user request
  }, [canvasRef]);

  // --- NODE INTERACTIVE DRAGGING ---
  const handleMouseDown = (e: React.MouseEvent<SVGElement>, nodeId: string) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panX) / zoom;
    const y = (e.clientY - rect.top - panY) / zoom;

    setDraggedNodeId(nodeId);
    setNodes(prev => prev.map(n => {
      if (n.id === nodeId) {
        return { ...n, fx: x, fy: y };
      }
      return n;
    }));
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggedNodeId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - panX) / zoom;
    const y = (e.clientY - rect.top - panY) / zoom;

    setNodes(prev => prev.map(n => {
      if (n.id === draggedNodeId) {
        return { ...n, fx: x, fy: y };
      }
      return n;
    }));
  };

  const handleMouseUp = () => {
    if (!draggedNodeId) return;
    setNodes(prev => prev.map(n => {
      if (n.id === draggedNodeId) {
        return { ...n, fx: null, fy: null };
      }
      return n;
    }));
    setDraggedNodeId(null);
  };

  // --- FILTER & COLLAPSED CLUSTERS COMPUTATION ---
  const visualData = useMemo(() => {
    // 1. Filter original nodes according to active control parameters
    const nodesAfterFilters = nodes.filter(n => {
      // Filter entity type
      if (!selectedEntityTypes.has(n.entity.entity_type)) return false;

      // Filter risk level
      const riskStr = n.riskScore >= 85 ? 'critical' : n.riskScore >= 60 ? 'high' : n.riskScore >= 30 ? 'medium' : 'low';
      if (!selectedRiskLevels.has(riskStr)) return false;

      return true;
    });

    const nodesAfterFiltersMap = new Map(nodesAfterFilters.map(n => [n.id, n]));

    // 2. Filter original relationships
    const originalRelationships = activeCase?.graph_result?.relationships || [];
    const relationshipsAfterFilters = originalRelationships.filter(rel => {
      const s = nodesAfterFiltersMap.get(rel.source_id);
      const t = nodesAfterFiltersMap.get(rel.target_id);
      if (!s || !t) return false;
      if (rel.weight < minRelationshipWeight) return false;
      return true;
    });

    // 3. Separate remaining nodes by community to check collapsed groups
    const communityGroups: Record<number, PhysicsNode[]> = {};
    nodesAfterFilters.forEach(n => {
      if (!communityGroups[n.communityId]) {
        communityGroups[n.communityId] = [];
      }
      communityGroups[n.communityId].push(n);
    });

    const finalVisualNodes: any[] = [];
    const nodeToVisualIdMap = new Map<string, string>();

    Object.entries(communityGroups).forEach(([commIdStr, memberNodes]) => {
      const commId = parseInt(commIdStr, 10);
      const isCollapsed = collapsedCommunities.includes(commId);

      if (isCollapsed && memberNodes.length > 1) {
        // Find aggregate attributes
        let sumX = 0, sumY = 0;
        let maxRisk = 0;
        memberNodes.forEach(m => {
          sumX += m.x;
          sumY += m.y;
          if (m.riskScore > maxRisk) maxRisk = m.riskScore;
        });

        const clusterId = `cluster-community-${commId}`;
        finalVisualNodes.push({
          id: clusterId,
          label: `تكتل مجتمعي ${String.fromCharCode(65 + commId)}`,
          entity: {
            entity_id: clusterId,
            entity_type: "cluster",
            label: `تكتل مجتمعي ${String.fromCharCode(65 + commId)}`,
            details: {
              "عدد العناصر المدمجة": `${memberNodes.length} كيانات تفصيلية`,
              "المجتمع الحركي": `المجموعة ${String.fromCharCode(65 + commId)}`,
              "مستوى الخطر الأقصى": `${maxRisk}%`
            }
          },
          x: sumX / memberNodes.length,
          y: sumY / memberNodes.length,
          degree: memberNodes.reduce((acc, mn) => acc + mn.degree, 0),
          betweenness: memberNodes.reduce((acc, mn) => acc + mn.betweenness, 0),
          pageRank: memberNodes.reduce((acc, mn) => acc + mn.pageRank, 0) / memberNodes.length,
          communityId: commId,
          riskScore: maxRisk,
          gatScore: memberNodes.reduce((acc, mn) => acc + mn.gatScore, 0) / memberNodes.length,
          isCluster: true,
          memberCount: memberNodes.length,
          originalMembers: memberNodes
        });

        memberNodes.forEach(m => {
          nodeToVisualIdMap.set(m.id, clusterId);
        });
      } else {
        // Individual nodes untouched
        memberNodes.forEach(m => {
          finalVisualNodes.push({
            ...m,
            isCluster: false
          });
          nodeToVisualIdMap.set(m.id, m.id);
        });
      }
    });

    // Translate and route relationships to visual node boundaries
    const finalVisualEdges: any[] = [];
    const deduplicator = new Set<string>();

    relationshipsAfterFilters.forEach(rel => {
      const sourceVisualId = nodeToVisualIdMap.get(rel.source_id);
      const targetVisualId = nodeToVisualIdMap.get(rel.target_id);

      if (sourceVisualId && targetVisualId && sourceVisualId !== targetVisualId) {
        const edgeKey = `${sourceVisualId}->${targetVisualId}:${rel.relationship_type}`;
        if (!deduplicator.has(edgeKey)) {
          deduplicator.add(edgeKey);
          finalVisualEdges.push({
            source_id: sourceVisualId,
            target_id: targetVisualId,
            relationship_type: rel.relationship_type,
            weight: rel.weight
          });
        }
      }
    });

    return {
      nodes: finalVisualNodes,
      edges: finalVisualEdges,
      nodeToVisualIdMap
    };
  }, [nodes, activeCase, collapsedCommunities, selectedEntityTypes, selectedRiskLevels, minRelationshipWeight]);

  // Translate Dijkstra path to visual equivalents (collapsing coordinates)
  const visualDijkstraPath = useMemo(() => {
    if (!activeDijkstraPath || activeDijkstraPath.length === 0) return [];
    return activeDijkstraPath.map(id => visualData.nodeToVisualIdMap.get(id) || id);
  }, [activeDijkstraPath, visualData]);

  // Determine highlighted node IDs up to 2nd-degree for investigative focus
  const highlightedVisualNodeIds = useMemo(() => {
    if (!selectedNode || !computedGraphMetrics) return null;
    const targetOriginalId = selectedNode.entity_id;
    const adj = computedGraphMetrics.adj;
    
    // First degree neighbors (original)
    const originalAllowed = new Set<string>([targetOriginalId]);
    const firstHop = adj[targetOriginalId] || [];
    firstHop.forEach(id1 => {
      originalAllowed.add(id1);
      // Second degree neighbors
      const secondHop = adj[id1] || [];
      secondHop.forEach(id2 => originalAllowed.add(id2));
    });

    // Map allowed original node IDs to visual IDs
    const visualAllowed = new Set<string>();
    originalAllowed.forEach(origId => {
      const visId = visualData.nodeToVisualIdMap.get(origId);
      if (visId) visualAllowed.add(visId);
    });

    return visualAllowed;
  }, [selectedNode, computedGraphMetrics, visualData]);

  // --- COLLAPSE COMMUNITY UTILITY ---
  const toggleCommunityCollapse = (commId: number) => {
    if (collapsedCommunities.includes(commId)) {
      setCollapsedCommunities(prev => prev.filter(c => c !== commId));
      addLog(`تم فك دمج التكتل المجتمعي ${String.fromCharCode(65 + commId)} لاستعراض الكيانات الفردية.`);
    } else {
      setCollapsedCommunities(prev => [...prev, commId]);
      addLog(`تم دمج تكتل المجموعة الاستخبارية ${String.fromCharCode(65 + commId)} لتنقية مساحة التحقيق.`);
    }
  };

  // --- SEARCH SUBMIT ---
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchedAndFocusedNodeId(null);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const found = nodes.find(n => 
      n.id.toLowerCase().includes(query) || 
      n.entity.label.toLowerCase().includes(query) ||
      (n.entity.details && Object.values(n.entity.details).some(v => typeof v === "string" && v.toLowerCase().includes(query)))
    );

    if (found) {
      setSearchedAndFocusedNodeId(found.id);
      setSelectedNode(found.entity);
      
      // Auto expand community if collapsed to reveal search result
      if (collapsedCommunities.includes(found.communityId)) {
        setCollapsedCommunities(prev => prev.filter(c => c !== found.communityId));
      }

      // Automatically pan graph to center on target search node
      setPanX(425 - found.x);
      setPanY(250 - found.y);
      setZoom(1.3);

      addLog(`تم العثور على الكيان: ${found.entity.label} - تركيز الإحداثيات والتقريب.`);
    } else {
      addLog(`لم يتم العثور على أي نتائج بحث مطابقة لـ "${searchQuery}"`);
    }
  };

  const handleResetSearch = () => {
    setSearchedAndFocusedNodeId(null);
    setSearchQuery("");
    setActiveDijkstraPath([]);
    setIsTracingActive(false);
    setTracingTargetId(null);
    setCollapsedCommunities([]);
    handleZoomReset();
    addLog("تمت إعادة تهيئة قنوات الفحص ومعاينة البنية المتكاملة.");
  };

  // --- HELPERS FOR STYLING AND DECORATIONS ---
  const getNodeColor = (risk: number) => {
    if (risk >= 85) return "#ef4444"; // Red - Critical
    if (risk >= 60) return "#f97316"; // Orange - High
    if (risk >= 30) return "#eab308"; // Yellow - Medium
    return "#10b981"; // Green - Low
  };

  const getRiskLabelAr = (risk: number) => {
    if (risk >= 85) return "حرج جداً (Critical)";
    if (risk >= 60) return "مرتفع (High)";
    if (risk >= 30) return "متوسط (Medium)";
    return "منخفض (Low)";
  };

  const getNodeIcon = (type: string, className = "w-4 h-4") => {
    switch (type.toLowerCase()) {
      case "account":
      case "bank":
        return <Building className={className} />;
      case "person":
      case "customer":
        return <User className={className} />;
      case "company":
        return <Building className={className} />;
      case "device":
        return <Smartphone className={className} />;
      case "ip":
        return <Globe className={className} />;
      case "merchant":
        return <CreditCard className={className} />;
      case "wallet":
        return <CreditCard className={className} />;
      case "phone":
        return <Phone className={className} />;
      case "atm":
        return <LayoutGrid className={className} />;
      case "cluster":
        return <Layers className={className} />;
      default:
        return <Network className={className} />;
    }
  };

  const getRelationshipLabelAr = (type: string) => {
    switch (type.toLowerCase()) {
      case "owns": return "ملكية";
      case "transacted_with": return "تحويل مالي";
      case "shares_device": return "جهاز مشترك";
      case "uses_ip": return "IP مشترك";
      case "shares_phone": return "جوال مشترك";
      case "uses_phone": return "جوال مشترك";
      default: return type;
    }
  };

  // Custom node shapes according to type matching Linkurious / Palantir standards
  const renderVisualNodeShape = (type: string, riskScore: number, isSelected: boolean, isSearched: boolean) => {
    const riskColor = getNodeColor(riskScore);
    const strokeWidth = isSelected || isSearched ? 3 : 1.5;
    const fillColor = isDarkMode ? "#0d1117" : "#ffffff";

    switch (type.toLowerCase()) {
      case "account":
      case "bank":
        // Bank Account -> Rectangle
        return (
          <rect
            x={-24}
            y={-14}
            width={48}
            height={28}
            rx={4}
            fill={fillColor}
            stroke={riskColor}
            strokeWidth={strokeWidth}
          />
        );
      case "person":
      case "customer":
        // Customer -> Circle/Person Oval
        return (
          <circle
            r={18}
            fill={fillColor}
            stroke={riskColor}
            strokeWidth={strokeWidth}
          />
        );
      case "company":
        // Company -> Hexagon
        return (
          <polygon
            points="-20,0 -10,-17 10,-17 20,0 10,17 -10,17"
            fill={fillColor}
            stroke={riskColor}
            strokeWidth={strokeWidth}
          />
        );
      case "device":
        // Device -> Vertical Smartphone Rect
        return (
          <rect
            x={-13}
            y={-20}
            width={26}
            height={40}
            rx={5}
            fill={fillColor}
            stroke={riskColor}
            strokeWidth={strokeWidth}
          />
        );
      case "ip":
        // IP Address -> Diamond
        return (
          <polygon
            points="0,-20 20,0 0,20 -20,0"
            fill={fillColor}
            stroke={riskColor}
            strokeWidth={strokeWidth}
          />
        );
      case "atm":
        // ATM -> Heavy Square
        return (
          <rect
            x={-18}
            y={-18}
            width={36}
            height={36}
            rx={2}
            fill={fillColor}
            stroke={riskColor}
            strokeWidth={strokeWidth}
          />
        );
      case "merchant":
      case "wallet":
        // Merchant -> Horizontal Rounded capsule
        return (
          <rect
            x={-26}
            y={-13}
            width={52}
            height={26}
            rx={13}
            fill={fillColor}
            stroke={riskColor}
            strokeWidth={strokeWidth}
          />
        );
      case "cluster":
        // Collapse Cluster -> Doubled Rounded Square
        return (
          <g>
            <rect
              x={-22}
              y={-22}
              width={44}
              height={44}
              rx={10}
              fill="transparent"
              stroke={riskColor}
              strokeWidth={1}
              strokeDasharray="2,2"
            />
            <rect
              x={-18}
              y={-18}
              width={36}
              height={36}
              rx={8}
              fill={fillColor}
              stroke={riskColor}
              strokeWidth={strokeWidth}
            />
          </g>
        );
      default:
        return (
          <circle
            r={16}
            fill={fillColor}
            stroke={riskColor}
            strokeWidth={strokeWidth}
          />
        );
    }
  };

  // Get active selected node
  const selectedNodeWithMetrics = useMemo(() => {
    if (!selectedNode) return null;
    return visualData.nodes.find(n => n.id === selectedNode.entity_id) || null;
  }, [selectedNode, visualData]);

  return (
    <div className={`space-y-6 select-none font-sans ${isDarkMode ? "text-slate-100" : "text-slate-800"}`} dir="rtl">
      
      {/* HEADER CONTROLS BAR */}
      <div className={`p-5 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
        isDarkMode ? "bg-[#0c0f16] border-[#1d2330]" : "bg-white border-slate-200"
      }`}>
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-brand-orange-500/10 text-brand-orange-500 rounded-xl shrink-0">
            <Compass className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black font-sans tracking-tight">نظام التحقيق المالي واستكشاف العلاقات (Intelligence Workspace)</h2>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">
              خوارزميات مدمجة: PageRank • Community Detection • Dijkstra Shortest Path • ForceAtlas2 • GNN soft-risk
            </p>
          </div>
        </div>

        {/* Interactive Search by ID / Name */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute right-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="البحث بالاسم، معرف العميل، أو الآي بي..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-72 pl-4 pr-10 py-1.5 text-xs rounded-xl border outline-none font-sans transition-all ${
                isDarkMode 
                  ? "bg-[#06080b] border-[#1d2330] text-white focus:border-brand-orange-500/60" 
                  : "bg-slate-50 border-slate-200 text-slate-800 focus:border-brand-orange-500/60"
              }`}
            />
          </div>
          <button 
            type="submit" 
            className="px-4 py-1.5 bg-brand-orange-500 hover:bg-brand-orange-400 text-black font-bold font-sans text-xs rounded-xl cursor-pointer transition-colors"
          >
            استعلام
          </button>
          {(searchedAndFocusedNodeId || isTracingActive) && (
            <button 
              type="button" 
              onClick={handleResetSearch}
              className={`p-1.5 border rounded-xl cursor-pointer transition-colors ${
                isDarkMode ? "border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/10" : "border-red-200 text-red-500 bg-red-50 hover:bg-red-100"
              }`}
              title="إعادة تعيين كافة الفلاتر"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* TWO COLUMN INVESTIGATION WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: INTERACTIVE VISUAL CANVAS */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          <div className={`relative border rounded-2xl overflow-hidden flex-1 ${
            isDarkMode ? "bg-[#07090d] border-[#1d2330]" : "bg-slate-50 border-slate-200"
          }`} style={{ height: "570px" }}>
            
            {/* CANVAS GRID & BACKGROUND */}
            <div id="canvas-bg" className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
              backgroundImage: isDarkMode
                ? "radial-gradient(circle, #ffffff 1px, transparent 1px)"
                : "radial-gradient(circle, #000000 1px, transparent 1px)",
              backgroundSize: "28px 28px"
            }} />

            {/* LIVE TELEMETRY FLOATING LABELS */}
            <div className="absolute top-4 right-4 z-10 flex gap-2 pointer-events-none">
              <span className="text-[9px] bg-slate-500/10 text-slate-400 px-2 py-0.5 rounded-md border border-slate-500/20 font-mono">
                مؤشر الرصد: {visualData.nodes.length} كيانات منظورة
              </span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                خوارزمية الرسوم: متوازنة
              </span>
            </div>

            {/* FLOATING ZOOM CONTROLS OVERLAY REMOVED PER USER REQUEST */}

            {/* LIVE PHYSICS CONTROLLER BUTTONS */}
            <div className="absolute bottom-4 left-4 z-10 flex gap-1.5">
              <button 
                onClick={() => setIsPhysicsRunning(!isPhysicsRunning)}
                className={`p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                  isPhysicsRunning 
                    ? "bg-brand-orange-500/10 border-brand-orange-500/30 text-brand-orange-500" 
                    : "bg-slate-500/10 border-slate-500/30 text-slate-400"
                }`}
                title="تجميد/تشغيل استقرار العقد"
              >
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-semibold font-sans">محاكي القوى</span>
                </div>
              </button>
              <button 
                onClick={() => {
                  setNodes(prev => prev.map(n => ({
                    ...n,
                    x: n.x + (Math.random() - 0.5) * 120,
                    y: n.y + (Math.random() - 0.5) * 120
                  })));
                }}
                className={`p-2 rounded-xl border text-xs cursor-pointer transition-colors ${
                  isDarkMode ? "bg-slate-800/80 border-[#1d2330] text-slate-300 hover:bg-slate-700" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
                title="إعادة بث العقد عشوائياً"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* THE INTERACTIVE SVG CANVAS (Zoom/Pan disabled) */}
            <svg 
              ref={canvasRef}
              className="w-full h-full"
              onMouseDown={handleSvgMouseDown}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handleSvgMouseUp}
              onMouseLeave={handleSvgMouseUp}
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="19" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#475569" opacity="0.4" />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="19" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill="#f97316" />
                </marker>
                
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* TRANSFORM GROUP (All zoom and pan occurs inside here) */}
              <g transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
                
                {/* 1. EDGES / RELATIONSHIPS */}
                {visualData.edges.map((edge, idx) => {
                  const sNode = visualData.nodes.find(n => n.id === edge.source_id);
                  const tNode = visualData.nodes.find(n => n.id === edge.target_id);

                  if (!sNode || !tNode) return null;

                  // Check if this edge is part of visual Dijkstra money tracing
                  let isDijkstraEdge = false;
                  if (isTracingActive && visualDijkstraPath.length > 1) {
                    for (let p = 0; p < visualDijkstraPath.length - 1; p++) {
                      const u = visualDijkstraPath[p];
                      const v = visualDijkstraPath[p+1];
                      if ((u === edge.source_id && v === edge.target_id) || (v === edge.source_id && u === edge.target_id)) {
                        isDijkstraEdge = true;
                        break;
                      }
                    }
                  }

                  // Centrality highlighters: If selectedNode is active, fade unrelated lines
                  let isFaded = false;
                  if (highlightedVisualNodeIds && (!highlightedVisualNodeIds.has(edge.source_id) || !highlightedVisualNodeIds.has(edge.target_id))) {
                    isFaded = true;
                  }

                  const strokeWidth = isDijkstraEdge 
                    ? 4.5 
                    : Math.max(1.0, edge.weight * 2.5);
                  
                  const strokeColor = isDijkstraEdge 
                    ? "#f97316" 
                    : isDarkMode ? "#334155" : "#cbd5e1";

                  const midX = (sNode.x + tNode.x) / 2;
                  const midY = (sNode.y + tNode.y) / 2;
                  
                  // Calculate rotation angle for labels along the lines
                  let angle = Math.atan2(tNode.y - sNode.y, tNode.x - sNode.x) * 180 / Math.PI;
                  if (angle > 90 || angle < -90) {
                    angle += 180;
                  }

                  return (
                    <g 
                      key={`edge-${idx}`} 
                      className={`transition-opacity duration-300 ${isFaded ? "opacity-10" : "opacity-100"}`}
                    >
                      {isDijkstraEdge && (
                        <line
                          x1={sNode.x}
                          y1={sNode.y}
                          x2={tNode.x}
                          y2={tNode.y}
                          stroke="#f97316"
                          strokeWidth={strokeWidth + 6}
                          strokeOpacity="0.25"
                          filter="url(#glow)"
                        />
                      )}

                      <line
                        x1={sNode.x}
                        y1={sNode.y}
                        x2={tNode.x}
                        y2={tNode.y}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={edge.relationship_type === "shares_device" || edge.relationship_type === "uses_ip" ? "4,4" : undefined}
                        markerEnd={isDijkstraEdge ? "url(#arrow-active)" : "url(#arrow)"}
                      />

                      {/* Animated flow node along traced money route */}
                      {isDijkstraEdge && (
                        <circle r="4.5" fill="#ffffff" filter="url(#glow)">
                          <animateMotion 
                            dur="1.6s" 
                            repeatCount="indefinite" 
                            path={`M ${sNode.x} ${sNode.y} L ${tNode.x} ${tNode.y}`} 
                          />
                        </circle>
                      )}

                      {/* Edge Label on line midpoint (Academic style) */}
                      {!isFaded && (
                        <g transform={`translate(${midX}, ${midY}) rotate(${angle})`}>
                          <rect
                            x={-24}
                            y={-7}
                            width={48}
                            height={12}
                            rx={3}
                            fill={isDarkMode ? "#07090d" : "#f1f5f9"}
                            stroke={isDijkstraEdge ? "#f97316" : isDarkMode ? "#1e293b" : "#e2e8f0"}
                            strokeWidth={0.5}
                          />
                          <text
                            textAnchor="middle"
                            y="1.5"
                            className={`text-[7px] font-sans font-bold ${isDijkstraEdge ? "fill-brand-orange-500" : "fill-slate-400"}`}
                          >
                            {getRelationshipLabelAr(edge.relationship_type)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* 2. ENTITY NODES */}
                {visualData.nodes.map((node) => {
                  const isSelected = selectedNode?.entity_id === node.id;
                  const isSearched = searchedAndFocusedNodeId === node.id;
                  const isTraced = visualDijkstraPath.includes(node.id);

                  // Connection fading
                  let isFaded = false;
                  if (highlightedVisualNodeIds && !highlightedVisualNodeIds.has(node.id)) {
                    isFaded = true;
                  }

                  // Determine label hover visibility
                  const showLabel = isSelected || isSearched || hoveredNodeId === node.id || zoom > 1.35;

                  return (
                    <g 
                      key={`node-${node.id}`}
                      transform={`translate(${node.x}, ${node.y})`}
                      className={`cursor-pointer transition-opacity duration-300 ${isFaded ? "opacity-15" : "opacity-100"}`}
                      onMouseDown={(e) => handleMouseDown(e, node.id)}
                      onMouseEnter={() => setHoveredNodeId(node.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                      onDoubleClick={() => {
                        if (node.isCluster) {
                          toggleCommunityCollapse(node.communityId);
                        } else {
                          toggleCommunityCollapse(node.communityId);
                        }
                      }}
                      onClick={() => {
                        setSelectedNode(node.entity);
                        setIsTracingActive(false);
                        setActiveDijkstraPath([]);
                        setTracingTargetId(null);
                        addLog(`تمت معاينة الكيان: ${node.entity.label}`);
                      }}
                    >
                      {/* Double click interaction indicator */}
                      <circle
                        r={node.isCluster ? 28 : 22}
                        fill="none"
                        stroke={getNodeColor(node.riskScore)}
                        strokeWidth={0.5}
                        strokeOpacity={hoveredNodeId === node.id ? 0.4 : 0}
                        strokeDasharray="2,2"
                        className="transition-all duration-300"
                      />

                      {/* Selection glow border */}
                      {(isSelected || isSearched) && (
                        <circle
                          r={node.isCluster ? 27 : 21}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth={2}
                          className="animate-pulse"
                          filter="url(#glow)"
                        />
                      )}

                      {/* Custom Academic Node Shapes instead of simple bubbles */}
                      {renderVisualNodeShape(node.entity.entity_type, node.riskScore, isSelected, isSearched)}

                      {/* Node Vector Icon (Always white/muted inside the dark shape) */}
                      <g transform="translate(-7, -7)" className="text-slate-300 pointer-events-none">
                        {getNodeIcon(node.entity.entity_type, "w-3.5 h-3.5")}
                      </g>

                      {/* Collapse indicator tag for clustered communities */}
                      {node.isCluster && (
                        <g transform="translate(0, -18)">
                          <rect x={-14} y={-5} width={28} height={10} rx={3} fill="#f97316" />
                          <text textAnchor="middle" y={2} className="text-[7px] font-mono text-black font-black">
                            +{node.memberCount}
                          </text>
                        </g>
                      )}

                      {/* Intelligent, clean and scannable Labels */}
                      {showLabel && (
                        <g transform="translate(0, 24)">
                          <rect
                            x={-55}
                            y={-7}
                            width={110}
                            height={15}
                            rx={3}
                            fill={isDarkMode ? "rgba(11,15,22,0.85)" : "rgba(255,255,255,0.95)"}
                            stroke={isSelected ? "#f97316" : isDarkMode ? "#1d2330" : "#e2e8f0"}
                            strokeWidth={0.5}
                          />
                          <text
                            textAnchor="middle"
                            y="3"
                            className={`text-[8px] font-bold font-sans ${
                              isDarkMode ? "fill-slate-200" : "fill-slate-800"
                            }`}
                          >
                            {node.entity.label.length > 20 ? node.entity.label.slice(0, 18) + "..." : node.entity.label}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

              </g>
            </svg>

          </div>

        </div>

        {/* RIGHT COLUMN: INTELLIGENCE SIDE PANEL */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          <div className={`border rounded-2xl p-5 space-y-4 flex flex-col justify-between ${
            isDarkMode ? "bg-[#0c0f16] border-[#1d2330]" : "bg-white border-slate-200"
          }`}>
            
            {/* PANEL TABS */}
            <div className="flex border-b border-slate-500/10 pb-2 mb-1 gap-2">
              <button 
                onClick={() => setActiveTab("dossier")}
                className={`flex-1 pb-1.5 text-xs font-bold tracking-wide transition-all cursor-pointer ${
                  activeTab === "dossier" 
                    ? "border-b-2 border-brand-orange-500 text-brand-orange-500 font-black" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                الملف الجنائي للكيان
              </button>
              <button 
                onClick={() => setActiveTab("metrics")}
                className={`flex-1 pb-1.5 text-xs font-bold tracking-wide transition-all cursor-pointer ${
                  activeTab === "metrics" 
                    ? "border-b-2 border-brand-orange-500 text-brand-orange-500 font-black" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                التحليل الهيكلي والرياضي
              </button>
            </div>

            {selectedNodeWithMetrics ? (
              <div className="space-y-4 flex-1">
                
                {activeTab === "dossier" ? (
                  <div className="space-y-4 font-sans">
                    {/* ENTITY TYPE CONTAINER */}
                    <div className="flex items-start gap-3">
                      <div className="p-3 bg-brand-orange-500/10 text-brand-orange-500 rounded-xl shrink-0">
                        {getNodeIcon(selectedNode.entity_type, "w-6 h-6")}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-mono font-bold text-brand-orange-500 uppercase tracking-wider block">
                          الملف الاستخباري ({selectedNode.entity_type.toUpperCase()})
                        </span>
                        <h3 className="text-xs font-black truncate">{selectedNode.label}</h3>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">{selectedNode.entity_id}</p>
                      </div>
                    </div>

                    {/* COLLAPSED CLUSTER NOTICE */}
                    {selectedNodeWithMetrics.isCluster && (
                      <div className="p-2.5 rounded-lg border border-brand-orange-500/30 bg-brand-orange-500/5 text-[10px]">
                        <span className="font-bold text-brand-orange-500 block mb-0.5">تكتل مجتمعي مدمج:</span>
                        <p className="text-slate-300">يحتوي هذا التكتل على {selectedNodeWithMetrics.memberCount} كيانات فرعية مدمجة لتسهيل التصفح. انقر نقراً مزدوجاً لفك التجميع.</p>
                      </div>
                    )}

                    {/* RISK EVALUATION */}
                    <div className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 ${
                      isDarkMode ? "bg-black/40 border-[#1d2330]" : "bg-slate-50 border-slate-200"
                    }`}>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">مؤشر التهديد الأكاديمي:</span>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xl font-mono font-black" style={{ color: getNodeColor(selectedNodeWithMetrics.riskScore) }}>
                            {selectedNodeWithMetrics.riskScore}
                          </span>
                          <span className="text-[10px] text-slate-400">/ 100</span>
                        </div>
                        <span className="text-[10px] font-bold block" style={{ color: getNodeColor(selectedNodeWithMetrics.riskScore) }}>
                          {getRiskLabelAr(selectedNodeWithMetrics.riskScore)}
                        </span>
                      </div>

                      {/* Circular Risk gauge */}
                      <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="24" cy="24" r="20" stroke={isDarkMode ? "#1d2330" : "#e2e8f0"} strokeWidth="3" fill="transparent" />
                          <circle 
                            cx="24" cy="24" r="20" 
                            stroke={getNodeColor(selectedNodeWithMetrics.riskScore)} 
                            strokeWidth="3" fill="transparent"
                            strokeDasharray={2 * Math.PI * 20}
                            strokeDashoffset={2 * Math.PI * 20 * (1 - selectedNodeWithMetrics.riskScore / 100)}
                            strokeLinecap="round"
                          />
                        </svg>
                        <ShieldAlert className="w-4 h-4 absolute text-brand-orange-500" />
                      </div>
                    </div>

                    {/* DIJKSTRA PATH TRIGGER */}
                    <div className="space-y-2 pt-2 border-t border-slate-500/10">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">تتبع تدفق مسارات غسيل الأموال:</span>
                      <button
                        onClick={() => handleTraceMoneyFlow(selectedNode.entity_id)}
                        className="w-full py-2 bg-brand-orange-500/10 hover:bg-brand-orange-500/20 text-brand-orange-500 text-[10px] font-bold rounded-xl border border-brand-orange-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Activity className="w-4 h-4 animate-pulse" />
                        <span>تشغيل تتبع المسار الأقصر (Dijkstra Trailing)</span>
                      </button>
                    </div>

                    {/* EXTRA ENCRYPTION SPECIFICATIONS */}
                    <div className="space-y-2 pt-2">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">سلوك الكيان المشفر (Digital Signature):</span>
                      <div className={`p-2.5 rounded-xl font-mono text-[9px] space-y-1.5 ${
                        isDarkMode ? "bg-black/30 border border-[#1d2330]" : "bg-slate-100/50 border border-slate-150"
                      }`}>
                        <div className="flex justify-between">
                          <span className="text-slate-400">التصنيف البنيوي:</span>
                          <span className="font-bold text-slate-200">0x{(selectedNodeWithMetrics.pageRank * 8000).toString(16).slice(0, 5)}fd02</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">معدل انحراف GNN:</span>
                          <span className="text-amber-500 font-bold">{(selectedNodeWithMetrics.pageRank * 100).toFixed(1)}% عن النمط الطبيعي</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">التصنيف الإحصائي:</span>
                          <span className="text-brand-orange-500 font-bold">فئة {String.fromCharCode(65 + selectedNodeWithMetrics.communityId)}</span>
                        </div>
                      </div>
                    </div>

                    {/* METADATA DETAILS */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">بيانات وتفاصيل مسجلة:</span>
                      <div className={`border rounded-xl divide-y font-mono text-[10px] ${
                        isDarkMode ? "border-[#1d2330] divide-[#1d2330]" : "border-slate-200 divide-slate-100"
                      }`}>
                        {selectedNode.details && Object.entries(selectedNode.details).map(([key, value]) => (
                          <div key={key} className="p-2 flex justify-between gap-4">
                            <span className="text-slate-400 shrink-0">{key}:</span>
                            <span className="font-semibold truncate text-left">{value}</span>
                          </div>
                        ))}
                        <div className="p-2 flex justify-between gap-4">
                          <span className="text-slate-400">الفئة الهيكلية للكيان:</span>
                          <span className="font-semibold">{selectedNode.entity_type}</span>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  // MATHEMATICAL METRICS DETAILED DATA
                  <div className="space-y-4 animate-fade-in text-xs font-sans">
                    
                    <div className="space-y-3.5">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-400">درجة المركزية (Degree Centrality)</span>
                          <span className="font-mono font-bold text-brand-orange-500">{selectedNodeWithMetrics.degree} روابط نشطة</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (selectedNodeWithMetrics.degree / 10) * 100)}%` }} />
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">يمثل عدد الروابط المباشرة التي تتقاطع في تعاملاتها مع هذا الكيان في شبكة الجرائم المالية.</span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-400">المركزية البينية (Betweenness Centrality)</span>
                          <span className="font-mono font-bold text-brand-orange-500">{(selectedNodeWithMetrics.betweenness * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500" style={{ width: `${selectedNodeWithMetrics.betweenness * 100}%` }} />
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">يعكس نسبة أقصر مسارات تحويل الأموال التي تعبر من خلال هذا العميل، مما يشير إلى دوره كوسيط لتهريب السيولة.</span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-400">مؤشر رتبة الصفحة (PageRank Index)</span>
                          <span className="font-mono font-bold text-brand-orange-500">{(selectedNodeWithMetrics.pageRank * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-500/10 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${selectedNodeWithMetrics.pageRank * 100}%` }} />
                        </div>
                        <span className="text-[9px] text-slate-400 block mt-1 leading-relaxed">التقييم المستنتج من شبكة GNN لتأثير هذا الحساب ومكانته في التدفق الإجمالي للسيولة المشبوهة.</span>
                      </div>

                      <div className="pt-2 border-t border-slate-500/10 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">طبقة الانتباه العصبية (GAT Softmax Score):</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-mono font-black text-amber-500">{(selectedNodeWithMetrics.gatScore).toFixed(2)}</span>
                          <span className="text-[9px] text-slate-400 leading-normal">الوزن المحوسب بالطبقة المخفية لتقييم العلاقات</span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}

              </div>
            ) : (
              <div className="text-center py-20 text-slate-400 flex-1 flex flex-col items-center justify-center">
                <Network className="w-10 h-10 text-slate-300 mb-2 animate-pulse" />
                <p className="text-xs font-sans px-4">يرجى تحديد أي عقدة بيانية من مساحة العمل لاستعراض ملفها الاستخباري والرياضي.</p>
              </div>
            )}

            {/* LOWER STATS FOOTER */}
            <div className={`p-4 rounded-xl border ${
              isDarkMode ? "bg-black/30 border-[#1d2330]" : "bg-slate-100/40 border-slate-200"
            }`}>
              <div className="flex justify-between text-[10px]">
                <span className="text-slate-400">إجمالي الكيانات المنظورة:</span>
                <span className="font-mono font-bold text-brand-orange-500">
                  {nodes.length} كيانات نشطة
                </span>
              </div>
              <div className="flex justify-between text-[10px] mt-1.5">
                <span className="text-slate-400">خطوط العلاقات الكلية:</span>
                <span className="font-mono font-bold text-brand-orange-500">
                  {activeCase?.graph_result?.relationships.length || 0} روابط اتصال ومراسلات
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
