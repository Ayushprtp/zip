import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Braces, Code, FileJson, Regex, Terminal } from "lucide-react";
import { NodeStatusBadge, type NodeStatus } from "./NodeStatusBadge";
import type { Extractor } from "@/components/httpchain/types/schema";
import { ExtractorType as ExtractorTypeEnum } from "@/components/httpchain/types/schema";
import { cn } from "@/components/httpchain/lib/utils";

export interface ExtractorNodeData {
  extractor: Extractor;
  stepName?: string;
  onSelect?: () => void;
  status?: NodeStatus;
  selected?: boolean;
}

interface ExtractorNodeProps {
  data: ExtractorNodeData;
  selected?: boolean;
}

// Get icon and label for extractor - now takes full extractor for function type details
function getExtractorInfo(extractor: Extractor): {
  icon: typeof Code;
  label: string;
} {
  switch (extractor.extractor_type) {
    case ExtractorTypeEnum.JSONPATHARRAY:
      return { icon: FileJson, label: "JSONPath" };
    case ExtractorTypeEnum.REGEX:
      return { icon: Regex, label: "Regex" };
    case ExtractorTypeEnum.DECLARATIVE_CHECK:
      return { icon: Braces, label: "Check" };
    case ExtractorTypeEnum.FUNCTION:
      // Registered function = Plugin, Code-based = Function (polyglot)
      if (extractor.function_extractor?.registered_function_name) {
        return { icon: Code, label: "Plugin" };
      }
      return { icon: Terminal, label: "Function" };
    default:
      return { icon: Braces, label: "Extract" };
  }
}

export const ExtractorNode = memo(
  ({ data, selected: reactFlowSelected }: ExtractorNodeProps) => {
    const { extractor, onSelect, status = "normal", selected = false } = data;
    const isSelected = selected || reactFlowSelected;
    const { icon: TypeIcon, label: typeLabel } = getExtractorInfo(extractor);

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
            {/* Icon with gradient - shows extractor type icon */}
            <div
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-xl",
                "bg-gradient-to-br from-primary/15 to-primary/5",
                "ring-1 ring-primary/20",
                "shadow-inner",
              )}
            >
              <TypeIcon className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                    "bg-primary/10 text-primary",
                  )}
                >
                  {typeLabel}
                </span>
              </div>
              <p className="text-sm font-semibold leading-tight truncate mt-1.5 font-mono text-card-foreground">
                {extractor.extractor_key}
              </p>
            </div>

            <NodeStatusBadge status={status} color="" />
          </div>

          {/* Visual indicator bar */}
          <div className="h-1 bg-gradient-to-r from-primary/0 via-primary/15 to-primary/0" />
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

ExtractorNode.displayName = "ExtractorNode";
