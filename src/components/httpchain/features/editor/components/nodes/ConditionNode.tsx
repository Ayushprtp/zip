import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { GitBranch, Zap } from "lucide-react";
import { NodeStatusBadge, type NodeStatus } from "./NodeStatusBadge";
import type { ConditionalLogic } from "@/components/httpchain/types/schema";
import { ConditionOperator as ConditionOperatorEnum } from "@/components/httpchain/types/schema";
import { cn } from "@/components/httpchain/lib/utils";

export interface ConditionNodeData {
  condition: ConditionalLogic;
  stepName?: string;
  onSelect?: () => void;
  status?: NodeStatus;
  selected?: boolean;
}

interface ConditionNodeProps {
  data: ConditionNodeData;
  selected?: boolean;
}

export const ConditionNode = memo(
  ({ data, selected: reactFlowSelected }: ConditionNodeProps) => {
    const { condition, onSelect, status = "normal", selected = false } = data;
    const operatorText =
      condition.operator === ConditionOperatorEnum.AND ? "AND" : "OR";
    const isSelected = selected || reactFlowSelected;
    const checkCount = condition.checks.length;

    return (
      <div className="relative group">
        {/* Glow effect on hover/select */}
        <div
          className={cn(
            "absolute -inset-1 rounded-2xl opacity-0 blur-md transition-opacity duration-300",
            "bg-gradient-to-r from-primary/30 via-primary/20 to-primary/30",
            isSelected && "opacity-100",
            "group-hover:opacity-60",
          )}
        />

        <div
          className={cn(
            "relative w-52 rounded-xl transition-all duration-200 cursor-pointer overflow-hidden",
            "border shadow-lg",
            "bg-gradient-to-br from-card via-card to-primary/5",
            "backdrop-blur-sm",
            isSelected
              ? "border-primary shadow-xl ring-2 ring-primary/30"
              : "border-border/60 hover:border-primary/50 hover:shadow-xl",
          )}
          onClick={onSelect}
        >
          {/* Top accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          <div className="flex items-center p-4 gap-3">
            {/* Icon with gradient */}
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl",
                "bg-gradient-to-br from-primary/15 to-primary/5",
                "ring-1 ring-primary/20",
                "shadow-inner",
              )}
            >
              <GitBranch className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-primary/60" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Condition
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-[11px] font-bold",
                    "bg-primary/10 text-primary",
                  )}
                >
                  {operatorText}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {checkCount} check{checkCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            <NodeStatusBadge status={status} color="" />
          </div>

          {/* Visual indicator bar */}
          <div className="h-1 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0" />
        </div>

        {/* Handles - vertical flow for conditions */}
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={true}
          className="!w-3 !h-3 !bg-primary !border-2 !border-card !shadow-md"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          isConnectable={true}
          className="!w-3 !h-3 !bg-primary !border-2 !border-card !shadow-md"
        />
      </div>
    );
  },
);

ConditionNode.displayName = "ConditionNode";
