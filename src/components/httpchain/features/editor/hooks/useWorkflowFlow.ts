import { useMemo } from "react";
import { useAppStore } from "@/components/httpchain/store";
import dagre from "dagre";

import type {
  StepNodeData,
  ExtractorNodeData,
  ConditionNodeData,
  InputVariableNodeData,
} from "@/components/httpchain/features/editor/components/nodes";

import { Position, type Edge, type Node } from "@xyflow/react";
type FlowNode = Node & {
  data:
    | StepNodeData
    | ExtractorNodeData
    | ConditionNodeData
    | InputVariableNodeData;
};

type FlowEdge = Edge;

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

function applyLayout(nodes: FlowNode[], edges: FlowEdge[], direction = "TB") {
  const isHorizontal = direction === "LR" || direction === "RL";

  dagreGraph.setGraph({
    rankdir: direction, // TB = top→bottom, LR = left→right
    ranksep: 100,
    nodesep: 80,
    edgesep: 30,
  });

  // Dagre needs width/height. We give rough estimates based on the new Shadcn Cards.
  nodes.forEach((n) => {
    let width = 200;
    let height = 100;

    if (n.type === "step") {
      width = 280; // w-64 is 256px, plus some padding
      height = 120;
    } else if (n.type === "inputVariable") {
      width = 220; // min 180, max 240
      height = 100;
    } else if (n.type === "condition") {
      width = 210; // w-48 is 192px
      height = 120;
    } else if (n.type === "extractor") {
      width = 220; // min 180, max 240
      height = 100;
    }

    dagreGraph.setNode(n.id, {
      width,
      height,
    });
  });

  edges.forEach((e) => {
    dagreGraph.setEdge(e.source, e.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((n) => {
    const pos = dagreGraph.node(n.id);

    return {
      ...n,
      position: {
        x: pos.x,
        y: pos.y,
      },
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
    };
  });
}

export function useWorkflowFlow() {
  const workflow = useAppStore((s) => s.workflow);
  const setSelectedStepNodeId = useAppStore((s) => s.setSelectedStepNodeId);
  const setSelectedStepTab = useAppStore((s) => s.setSelectedStepTab);

  return useMemo(() => {
    if (!workflow) return { nodes: [], edges: [] };

    const nodes: FlowNode[] = [];
    const edges: FlowEdge[] = [];

    // Used to connect extractors by extractor_key
    const extractorNodeMap = new Map<string, string>();

    //
    // 1. Input Variable Nodes
    //
    workflow.chain_variables.forEach((variableName) => {
      const nodeId = `input-${variableName}`;

      nodes.push({
        id: nodeId,
        type: "inputVariable",
        position: { x: 0, y: 0 }, // layout determines final position
        data: {
          variableName,
          status: "normal",
          selected: false,
          // No onSelect - input variable nodes don't open anything
        } as InputVariableNodeData as any,
      } as FlowNode);
    });

    //
    // 2. Steps, Extractors & Conditions
    //
    workflow.steps.forEach((step) => {
      const stepNodeId = `step-${step.node_id}`;

      // STEP NODE
      nodes.push({
        id: stepNodeId,
        type: "step",
        position: { x: 0, y: 0 },
        data: {
          step,
          status: "normal",
          selected: false,
          onSelect: () => {
            setSelectedStepNodeId(step.node_id);
            setSelectedStepTab(null); // Default to "request" tab
          },
        } as StepNodeData as any,
      } as FlowNode);

      //
      // Dependencies (input variables + extractors)
      //
      step.depends_on_variables?.forEach((depVar) => {
        const inputId = `input-${depVar}`;
        const extractorId = extractorNodeMap.get(depVar);

        if (workflow.chain_variables.includes(depVar)) {
          // Input → Step
          edges.push({
            id: `edge-${inputId}-${stepNodeId}`,
            source: inputId,
            target: stepNodeId,
            type: "smoothstep",
            animated: true,
          });
        } else if (extractorId) {
          // Extractor → Step
          edges.push({
            id: `edge-${extractorId}-${stepNodeId}`,
            source: extractorId,
            target: stepNodeId,
            type: "smoothstep",
            animated: true,
          });
        }
      });

      //
      // EXTRACTOR NODES
      //
      step.request.extractors?.forEach((extractor) => {
        const extractorId = `extractor-${step.node_id}-${extractor.extractor_key}`;

        nodes.push({
          id: extractorId,
          type: "extractor",
          position: { x: 0, y: 0 },
          data: {
            extractor,
            stepName: step.name,
            status: "normal",
            selected: false,
            onSelect: () => {
              setSelectedStepNodeId(step.node_id);
              setSelectedStepTab("extractors");
            },
          } as ExtractorNodeData as any,
        } as FlowNode);

        extractorNodeMap.set(extractor.extractor_key, extractorId);

        edges.push({
          id: `edge-${stepNodeId}-${extractorId}`,
          source: stepNodeId,
          target: extractorId,
          type: "smoothstep",
          animated: true,
          label: "produces",
        });
      });

      //
      // CONDITION NODE
      //
      if (step.condition) {
        const conditionId = `condition-${step.node_id}`;

        nodes.push({
          id: conditionId,
          type: "condition",
          position: { x: 0, y: 0 },
          data: {
            condition: step.condition,
            stepName: step.name,
            status: "normal",
            selected: false,
            onSelect: () => {
              setSelectedStepNodeId(step.node_id);
              setSelectedStepTab("condition");
            },
          } as ConditionNodeData as any,
        } as FlowNode);

        edges.push({
          id: `edge-${conditionId}-${stepNodeId}`,
          source: conditionId,
          target: stepNodeId,
          type: "straight",
          animated: true,
        });
      }
    });

    //
    // 3. APPLY AUTO-LAYOUT (DAGRE)
    //
    const layoutedNodes = applyLayout(nodes, edges, "LR"); // or "LR"

    return { nodes: layoutedNodes, edges };
  }, [workflow, setSelectedStepNodeId, setSelectedStepTab]);
}
