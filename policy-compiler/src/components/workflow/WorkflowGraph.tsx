"use client";

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Node,
  Edge,
  NodeTypes,
  MarkerType,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { memo, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// ─── Custom Node Types ────────────────────────────────────────────────────────

const BaseNode = ({ data, selected, nodeColor, typeLabel }: any) => (
  <div
    className={cn(
      "relative px-4 py-3 rounded-xl shadow-lg border-2 min-w-[170px] max-w-[220px] text-center transition-all",
      nodeColor,
      selected ? "ring-2 ring-blue-400 ring-offset-2" : ""
    )}
  >
    <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-300 !border-0" />
    <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-slate-300 !border-0" />
    {typeLabel && (
      <p className="text-[9px] uppercase tracking-wide opacity-80 mb-1 font-semibold">{typeLabel}</p>
    )}
    {data.phase && (
      <p className="text-[9px] uppercase tracking-wide opacity-70 mb-1">
        {String(data.phase).replace("_", " ")}
      </p>
    )}
    <p className="text-xs font-bold leading-tight">{data.label}</p>
    {data.description && (
      <p className="text-[10px] opacity-75 mt-1 leading-tight">{data.description}</p>
    )}
  </div>
);

const StartNode = (props: any) => (
  <BaseNode {...props} typeLabel="Start" nodeColor="bg-emerald-500 border-emerald-600 text-white" />
);
const ProcessNode = (props: any) => (
  <BaseNode {...props} typeLabel="Action" nodeColor="bg-blue-500 border-blue-600 text-white" />
);
const DecisionNode = (props: any) => (
  <div className="relative w-36 h-36 flex items-center justify-center">
    <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-amber-500 !border-0" />
    <Handle type="source" id="left" position={Position.Left} className="!w-2 !h-2 !bg-amber-500 !border-0" />
    <Handle type="source" id="right" position={Position.Right} className="!w-2 !h-2 !bg-amber-500 !border-0" />
    <Handle type="source" id="bottom" position={Position.Bottom} className="!w-2 !h-2 !bg-amber-500 !border-0" />
    <div
      className={cn(
        "transform rotate-45 w-28 h-28 bg-amber-400 border-2 border-amber-500 shadow-lg flex items-center justify-center",
        props.selected ? "ring-2 ring-blue-400 ring-offset-2" : ""
      )}
    >
      <div className="-rotate-45 text-center px-2">
        <p className="text-[9px] uppercase tracking-wide text-amber-900/80 font-semibold mb-1">Decision</p>
        <p className="text-[10px] font-bold text-amber-900 leading-tight">{props.data.label}</p>
      </div>
    </div>
  </div>
);
const ApprovalNode = (props: any) => (
  <BaseNode {...props} typeLabel="Approval" nodeColor="bg-purple-500 border-purple-600 text-white" />
);
const EscalationNode = (props: any) => (
  <BaseNode {...props} typeLabel="Escalation" nodeColor="bg-yellow-400 border-yellow-500 text-yellow-900" />
);
const EndSuccessNode = (props: any) => (
  <BaseNode {...props} typeLabel="Final Outcome" nodeColor="bg-emerald-500 border-emerald-600 text-white" />
);
const EndFailureNode = (props: any) => (
  <BaseNode {...props} typeLabel="Final Outcome" nodeColor="bg-red-500 border-red-600 text-white" />
);
const ExceptionNode = (props: any) => (
  <BaseNode {...props} typeLabel="Exception" nodeColor="bg-orange-500 border-orange-600 text-white" />
);

const nodeTypes: NodeTypes = {
  start: StartNode,
  process: ProcessNode,
  decision: DecisionNode,
  approval: ApprovalNode,
  escalation: EscalationNode,
  end_success: EndSuccessNode,
  end_failure: EndFailureNode,
  exception: ExceptionNode,
};

// ─── Default edge style ───────────────────────────────────────────────────────

const defaultEdgeOptions = {
  style: { strokeWidth: 2, stroke: "#94a3b8" },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
};

// ─── Main Component ───────────────────────────────────────────────────────────

interface WorkflowGraphProps {
  nodes: Node[];
  edges: Edge[];
  className?: string;
  onNodeSelect?: (node: Node | null) => void;
}

export const WorkflowGraph = memo(({ nodes, edges, className, onNodeSelect }: WorkflowGraphProps) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const classifyNodeType = (node: Node): string => {
    const data = (node.data || {}) as Record<string, any>;
    const typeHint = String(node.type || data.nodeType || data.step_type || "").toLowerCase();
    const label = String(data.label || (node as any).label || "").toLowerCase();
    if (typeHint.includes("start") || label.includes("start")) return "start";
    if (typeHint.includes("decision") || label.includes("if ") || label.includes("check") || label.includes("eligible")) return "decision";
    if (typeHint.includes("exception") || label.includes("exception") || label.includes("missing") || label.includes("invalid")) return "exception";
    if (typeHint.includes("escalation") || label.includes("escalat") || label.includes("tier")) return "escalation";
    if (typeHint.includes("approval") || label.includes("approve")) return "approval";
    if (typeHint.includes("end_failure") || label.includes("reject") || label.includes("deny") || label.includes("fail")) return "end_failure";
    if (typeHint.includes("end_success") || label.includes("complete") || label.includes("close") || label.includes("resolved")) return "end_success";
    if (typeHint.includes("end")) return "end_success";
    return "process";
  };

  const derivePathType = (edge: Edge, sourceType?: string, targetType?: string) => {
    const explicit = String((edge as any).path_type || "").toLowerCase();
    const label = String(edge.label || "").toLowerCase();
    if (explicit) return explicit;
    if (targetType === "exception" || label.includes("missing") || label.includes("exception") || label.includes("invalid")) return "exception";
    if (targetType === "escalation" || label.includes("escalat") || label.includes("tier")) return "escalation";
    if (targetType === "end_failure" || label.includes("reject") || label.includes("denied") || label.includes("failed") || label.includes("no")) return "failure";
    if (targetType === "end_success" || label.includes("approve") || label.includes("yes") || label.includes("complete")) return "success";
    if (sourceType === "decision" && !label) return "branch";
    return "normal";
  };

  const graphData = useMemo(() => {
    const rawNodes = (nodes || []).map((node, index) => {
      const data = (node.data || {}) as Record<string, any>;
      return {
        ...node,
        id: String(node.id),
        type: classifyNodeType(node),
        data: {
          ...data,
          label: String(data.label || (node as any).label || `Step ${index + 1}`),
          description: String(data.description || (node as any).description || ""),
        },
      } as Node;
    });

    const nodeMap = new Map(rawNodes.map((node) => [node.id, node]));
    const inbound = new Map<string, number>();
    const outbound = new Map<string, number>();
    rawNodes.forEach((node) => {
      inbound.set(node.id, 0);
      outbound.set(node.id, 0);
    });

    let normalizedEdges = (edges || [])
      .filter((edge) => nodeMap.has(String(edge.source)) && nodeMap.has(String(edge.target)))
      .map((edge, index) => ({
        ...edge,
        id: edge.id || `edge-${String(edge.source)}-${String(edge.target)}-${index}`,
        source: String(edge.source),
        target: String(edge.target),
      })) as Edge[];

    if (normalizedEdges.length === 0 && rawNodes.length > 1) {
      const sorted = [...rawNodes].sort((a, b) => {
        const aN = Number((a.data as any)?.step_number ?? Number.MAX_SAFE_INTEGER);
        const bN = Number((b.data as any)?.step_number ?? Number.MAX_SAFE_INTEGER);
        if (aN !== bN) return aN - bN;
        return a.id.localeCompare(b.id);
      });
      normalizedEdges = sorted.slice(0, -1).map((node, index) => ({
        id: `edge-fallback-${index}`,
        source: node.id,
        target: sorted[index + 1].id,
        label: "next",
      }));
    }

    normalizedEdges.forEach((edge) => {
      inbound.set(edge.target, (inbound.get(edge.target) || 0) + 1);
      outbound.set(edge.source, (outbound.get(edge.source) || 0) + 1);
    });

    const startNodes = rawNodes.filter((node) => node.type === "start");
    const rootNodes = startNodes.length > 0
      ? startNodes
      : rawNodes.filter((node) => (inbound.get(node.id) || 0) === 0);
    const queue = rootNodes.map((node) => node.id);
    const levelById = new Map<string, number>();
    queue.forEach((id) => levelById.set(id, 0));

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levelById.get(current) || 0;
      const nextEdges = normalizedEdges.filter((edge) => edge.source === current);
      nextEdges.forEach((edge) => {
        const nextLevel = currentLevel + 1;
        const priorLevel = levelById.get(edge.target);
        if (priorLevel === undefined || nextLevel > priorLevel) {
          levelById.set(edge.target, nextLevel);
          queue.push(edge.target);
        }
      });
    }

    let maxLevel = Math.max(0, ...Array.from(levelById.values()));
    rawNodes.forEach((node) => {
      if (!levelById.has(node.id)) {
        maxLevel += 1;
        levelById.set(node.id, maxLevel);
      }
    });

    const laneById = new Map<string, number>();
    rawNodes.forEach((node) => {
      let lane = 0;
      if (node.type === "exception" || node.type === "end_failure") lane = -1;
      if (node.type === "escalation") lane = 1;
      if (node.type === "approval") lane = 1;
      laneById.set(node.id, lane);
    });

    normalizedEdges.forEach((edge) => {
      const targetLane = laneById.get(edge.target) || 0;
      const sourceType = nodeMap.get(edge.source)?.type;
      if (sourceType === "decision" && targetLane === 0) {
        const pathType = derivePathType(edge, sourceType, nodeMap.get(edge.target)?.type);
        if (pathType === "exception" || pathType === "failure") laneById.set(edge.target, -1);
        if (pathType === "escalation") laneById.set(edge.target, 1);
      }
    });

    const usedSlots = new Map<string, number>();
    const positionedNodes = rawNodes.map((node) => {
      const level = levelById.get(node.id) || 0;
      const lane = laneById.get(node.id) || 0;
      const slotKey = `${level}:${lane}`;
      const slot = usedSlots.get(slotKey) || 0;
      usedSlots.set(slotKey, slot + 1);

      const horizontalStep = 320;
      const verticalStep = 170;
      const slotOffset = (slot - 0.5) * 130;
      const x = 430 + lane * horizontalStep + slotOffset;
      const y = 80 + level * verticalStep;

      return {
        ...node,
        position: { x, y },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      } as Node;
    });

    const attachedTargets = new Set(normalizedEdges.map((edge) => edge.target));
    const dangling = positionedNodes.filter((node) => (outbound.get(node.id) || 0) === 0 && node.type !== "end_success" && node.type !== "end_failure");
    const ends = positionedNodes.filter((node) => node.type === "end_success" || node.type === "end_failure");
    dangling.forEach((node) => {
      const closestEnd = ends
        .filter((end) => !attachedTargets.has(end.id) || end.type === "end_success")
        .sort((a, b) => Math.abs((a.position?.y || 0) - (node.position?.y || 0)) - Math.abs((b.position?.y || 0) - (node.position?.y || 0)))[0];
      if (closestEnd) {
        normalizedEdges.push({
          id: `edge-auto-complete-${node.id}-${closestEnd.id}`,
          source: node.id,
          target: closestEnd.id,
          label: closestEnd.type === "end_failure" ? "failed" : "completed",
        });
      }
    });

    const styledEdges = normalizedEdges.map((edge) => {
      const sourceType = nodeMap.get(edge.source)?.type;
      const targetType = nodeMap.get(edge.target)?.type;
      const pathType = derivePathType(edge, sourceType, targetType);
      const palette: Record<string, { stroke: string; dash?: string; animated?: boolean }> = {
        normal: { stroke: "#2563eb", animated: true },
        branch: { stroke: "#0f766e" },
        success: { stroke: "#16a34a" },
        exception: { stroke: "#f97316", dash: "6 4" },
        escalation: { stroke: "#eab308", dash: "6 4" },
        failure: { stroke: "#ef4444" },
      };
      const style = palette[pathType] || palette.normal;
      return {
        ...edge,
        type: "smoothstep",
        data: { ...(edge.data ?? {}), path_type: pathType },
        sourceHandle: sourceType === "decision"
          ? pathType === "exception" || pathType === "failure"
            ? "left"
            : pathType === "escalation"
            ? "right"
            : "bottom"
          : edge.sourceHandle,
        style: {
          strokeWidth: pathType === "normal" ? 2.8 : 2.4,
          stroke: style.stroke,
          strokeDasharray: style.dash,
        },
        animated: Boolean(style.animated),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: style.stroke,
        },
        label: edge.label || (pathType === "normal" ? "next" : pathType.replace("_", " ")),
        labelStyle: { fontSize: 11, fontWeight: 700, fill: "#334155" },
        labelBgStyle: { fill: "white", opacity: 0.92 },
        labelBgPadding: [4, 6] as [number, number],
        labelBgBorderRadius: 4,
      } as Edge;
    });

    return {
      nodes: positionedNodes,
      edges: styledEdges,
    };
  }, [nodes, edges]);

  const selectedNode = useMemo(
    () => graphData.nodes.find((node) => node.id === selectedNodeId) || null,
    [graphData.nodes, selectedNodeId]
  );

  if (!nodes || nodes.length === 0) {
    return (
      <div className={cn("flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200", className)}>
        <p className="text-slate-400 text-sm">No workflow graph available</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl overflow-hidden border border-slate-200 bg-white h-full relative", className)}>
      <ReactFlow
        nodes={graphData.nodes}
        edges={graphData.edges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodeClick={(_, node) => {
          setSelectedNodeId(node.id);
          onNodeSelect?.(node);
        }}
        onPaneClick={() => {
          setSelectedNodeId(null);
          onNodeSelect?.(null);
        }}
        fitView
        fitViewOptions={{ padding: 0.16, includeHiddenNodes: false, maxZoom: 1.25 }}
        minZoom={0.3}
        maxZoom={1.9}
        nodesDraggable={false}
        elementsSelectable
        attributionPosition="bottom-right"
        proOptions={{ hideAttribution: true }}
      >
        <Controls className="shadow-lg" showInteractive={false} />
        <MiniMap
          className="!w-[150px] !h-[92px] shadow-md !bg-white border border-slate-200"
          pannable
          zoomable
          nodeStrokeWidth={3}
          position="bottom-right"
          nodeColor={(node) => {
            const type = node.type || "process";
            const colors: Record<string, string> = {
              start: "#10b981",
              end_success: "#10b981",
              end_failure: "#ef4444",
              decision: "#f59e0b",
              approval: "#8b5cf6",
              escalation: "#eab308",
              exception: "#f97316",
              process: "#3b82f6",
            };
            return colors[type] || "#94a3b8";
          }}
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
      </ReactFlow>

      {selectedNode && (
        <div className="absolute bottom-4 left-4 z-20 w-[320px] max-w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white/95 backdrop-blur-sm shadow-lg p-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {String((selectedNode.data as any)?.label || (selectedNode as any).label || "Untitled step")}
            </p>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mb-2 line-clamp-3">
            {String((selectedNode.data as any)?.description || (selectedNode as any)?.description || "No description available.")}
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Type</p>
              <p className="font-medium text-slate-700 uppercase tracking-wide">{String(selectedNode.type || "process").replace("_", " ")}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Human Review</p>
              <p className="font-medium text-slate-700">
                {Boolean((selectedNode.data as any)?.human_review_required || (selectedNode.data as any)?.requires_human_review || (selectedNode.data as any)?.manual_review)
                  ? "Required"
                  : "Not required"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

WorkflowGraph.displayName = "WorkflowGraph";
