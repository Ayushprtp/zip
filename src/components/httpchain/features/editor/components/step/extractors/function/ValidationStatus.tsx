import { CheckCircle2, XCircle, AlertCircle, ExternalLink } from "lucide-react";
import type { ValidationResult } from "./types";
import { cn } from "@/components/httpchain/lib/utils";

interface ValidationStatusProps {
  result: ValidationResult;
  className?: string;
  compact?: boolean;
}

function getStatusDisplay(result: ValidationResult) {
  if (result.valid) {
    return {
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
      label: "Valid",
    };
  }

  // String-based error code matching
  const errorCode = result.errorCode;

  if (errorCode === "common.empty_code") {
    return {
      icon: AlertCircle,
      color: "text-muted-foreground",
      bgColor: "bg-muted/30",
      borderColor: "border-transparent",
      label: "Empty",
    };
  }

  if (
    errorCode.includes("forbidden_import") ||
    errorCode.includes("forbidden_builtin")
  ) {
    return {
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      label: "Security",
    };
  }

  // Default error
  return {
    icon: XCircle,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    label: "Error",
  };
}

export function ValidationStatus({
  result,
  className,
  compact = false,
}: ValidationStatusProps) {
  const status = getStatusDisplay(result);
  const Icon = status.icon;

  // Compact inline version
  if (compact) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs", className)}>
        <Icon className={cn("h-3.5 w-3.5", status.color)} />
        <span className={cn("font-medium", status.color)}>{status.label}</span>
        {result.line && !result.valid && (
          <span className="text-muted-foreground">@ L{result.line}</span>
        )}
      </div>
    );
  }

  // Full version with error details (only show when there's an error)
  if (result.valid || result.errorCode === "common.empty_code") {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-xs",
        status.bgColor,
        status.borderColor,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", status.color)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("font-medium", status.color)}>
              {result.errorMessage}
            </span>
            {result.line && (
              <span className="text-muted-foreground text-[10px]">
                Line {result.line}
              </span>
            )}
          </div>
        </div>
        {result.helpArticleId && (
          <button
            type="button"
            className="flex-shrink-0 text-[10px] text-primary hover:underline flex items-center gap-0.5"
            onClick={() => console.log(`Help: ${result.helpArticleId}`)}
          >
            <ExternalLink className="h-2.5 w-2.5" />
            Why?
          </button>
        )}
      </div>
    </div>
  );
}
