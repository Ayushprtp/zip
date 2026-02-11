import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Globe, ArrowRight } from "lucide-react";
import { NodeStatusBadge, type NodeStatus } from "./NodeStatusBadge";
import type { Step } from "@/components/httpchain/types/schema";
import { cn } from "@/components/httpchain/lib/utils";

export interface StepNodeData {
  step: Step;
  onSelect?: () => void;
  status?: NodeStatus;
  selected?: boolean;
}

interface StepNodeProps {
  data: StepNodeData;
  selected?: boolean;
}

// Extract domain from URL for display
function extractDomain(url: string): string {
  if (!url) return "No URL set";
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // If not a valid URL, return first part
    return url.slice(0, 30) || "No URL set";
  }
}

export const StepNode = memo(
  ({ data, selected: reactFlowSelected }: StepNodeProps) => {
    const { step, onSelect, status = "normal", selected = false } = data;
    const isSelected = selected || reactFlowSelected;
    const method = step.request.request_method;
    const domain = extractDomain(step.request.request_url);

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
            "relative w-72 rounded-xl transition-all duration-200 cursor-pointer overflow-hidden",
            "border shadow-lg",
            "bg-gradient-to-br from-card via-card to-card/95",
            "backdrop-blur-sm",
            isSelected
              ? "border-primary shadow-xl ring-2 ring-primary/30"
              : "border-border/60 hover:border-border hover:shadow-xl",
          )}
          onClick={onSelect}
        >
          {/* Subtle top gradient accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {/* Header with method badge */}
          <div className="flex items-center gap-3 p-4 pb-3">
            {/* Icon container with gradient */}
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl",
                "bg-gradient-to-br from-primary/10 to-primary/5",
                "ring-1 ring-primary/20",
                "shadow-inner",
              )}
            >
              <Globe className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight truncate text-card-foreground">
                {step.name}
              </p>
              {/* Domain preview */}
              <p className="text-[11px] text-muted-foreground mt-1 truncate font-mono">
                {domain}
              </p>
            </div>

            <NodeStatusBadge status={status} color="" />
          </div>

          {/* Footer with method and arrow - NEUTRAL styling */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border/40">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide bg-primary/10 text-primary">
              {method}
            </span>
            <ArrowRight className="w-4 h-4 text-muted-foreground/50" />
          </div>
        </div>

        {/* Handles */}
        <Handle
          type="target"
          position={Position.Left}
          isConnectable={true}
          className="!w-3 !h-3 !bg-primary !border-2 !border-card !shadow-md"
        />
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

StepNode.displayName = "StepNode";
