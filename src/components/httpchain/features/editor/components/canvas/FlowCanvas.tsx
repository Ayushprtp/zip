import { useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useAppStore } from "@/components/httpchain/store";
import { nodeTypes } from "../nodes";
import { useWorkflowFlow } from "../../hooks/useWorkflowFlow";

export function FlowCanvas() {
  const theme = useAppStore((s) => s.theme);
  const { nodes: initialNodes, edges: initialEdges } = useWorkflowFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when workflow changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        fitView
        colorMode={theme}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="var(--canvas-dots)"
          className="!bg-canvas"
        />
        <Controls
          showInteractive={false}
          className="!shadow-lg !border !border-border !rounded-lg !overflow-hidden"
        />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "inputVariable") return "rgb(16 185 129)"; // emerald-500
            if (node.type === "step") return "var(--primary)";
            if (node.type === "extractor") return "rgb(16 185 129)"; // emerald-500
            if (node.type === "condition") return "rgb(245 158 11)"; // amber-500
            return "var(--muted-foreground)";
          }}
          maskColor="rgba(0, 0, 0, 0.08)"
          className="!shadow-lg !border !border-border !rounded-lg !overflow-hidden !bg-card"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
