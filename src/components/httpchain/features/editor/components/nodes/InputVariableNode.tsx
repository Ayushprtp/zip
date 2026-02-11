import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Variable, Sparkles } from "lucide-react";
import { NodeStatusBadge, type NodeStatus } from "./NodeStatusBadge";
import { cn } from "@/components/httpchain/lib/utils";

export interface InputVariableNodeData {
  variableName: string;
  onSelect?: () => void;
  status?: NodeStatus;
  selected?: boolean;
}

interface InputVariableNodeProps {
  data: InputVariableNodeData;
  selected?: boolean;
}

export const InputVariableNode = memo(
  ({ data, selected: reactFlowSelected }: InputVariableNodeProps) => {
    const {
      variableName,
      onSelect,
      status = "normal",
      selected = false,
    } = data;
    const isSelected = selected || reactFlowSelected;

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
            "relative min-w-[200px] max-w-[260px] rounded-xl transition-all duration-200 cursor-pointer overflow-hidden",
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
              <Variable className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-primary/60" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Input
                </span>
              </div>
              <p className="text-sm font-semibold leading-tight truncate mt-1 font-mono text-card-foreground">
                {variableName}
              </p>
            </div>

            <NodeStatusBadge status={status} color="" />
          </div>

          {/* Subtle bottom gradient */}
          <div className="h-1 bg-gradient-to-r from-primary/0 via-primary/15 to-primary/0" />
        </div>

        {/* Handle - only source (outputs) */}
        <Handle
          type="source"
          position={Position.Right}
          isConnectable={true}
          className="!w-3 !h-3 !bg-primary !border-2 !border-card !shadow-md"
        />
      </div>
    );
  },
);

InputVariableNode.displayName = "InputVariableNode";
