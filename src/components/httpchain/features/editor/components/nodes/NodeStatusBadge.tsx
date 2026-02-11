import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/components/httpchain/lib/utils";

export type NodeStatus = "success" | "warning" | "error" | "normal";

interface NodeStatusBadgeProps {
  status: NodeStatus;
  color?: string;
  className?: string;
}

export function NodeStatusBadge({ status, className }: NodeStatusBadgeProps) {
  if (status === "normal") return null;

  const getBadgeColor = () => {
    switch (status) {
      case "success":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "error":
        return "text-destructive";
      default:
        return "";
    }
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      {status === "success" && (
        <CheckCircle2 className={cn("h-5 w-5", getBadgeColor())} />
      )}
      {status === "warning" && (
        <AlertTriangle className={cn("h-5 w-5", getBadgeColor())} />
      )}
      {status === "error" && (
        <XCircle className={cn("h-5 w-5", getBadgeColor())} />
      )}
    </div>
  );
}
