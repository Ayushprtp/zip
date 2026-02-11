import { StepNode, type StepNodeData } from "./StepNode";
import { ConditionNode, type ConditionNodeData } from "./ConditionNode";
import { ExtractorNode, type ExtractorNodeData } from "./ExtractorNode";
import {
  InputVariableNode,
  type InputVariableNodeData,
} from "./InputVariableNode";

export { StepNode, type StepNodeData };
export { ConditionNode, type ConditionNodeData };
export { ExtractorNode, type ExtractorNodeData };
export { InputVariableNode, type InputVariableNodeData };

// Node type definitions for React Flow
export const nodeTypes = {
  step: StepNode,
  condition: ConditionNode,
  extractor: ExtractorNode,
  inputVariable: InputVariableNode,
} as const;
