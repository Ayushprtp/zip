import { getCheckDisplayParts } from "@/components/httpchain/shared/utils/conditionDisplay";
import type { DeclarativeCheck } from "@/components/httpchain/types/schema";

interface CheckDisplayProps {
  check: DeclarativeCheck;
}

export function CheckDisplay({ check }: CheckDisplayProps) {
  const parts = getCheckDisplayParts(check);

  return (
    <span className="text-sm">
      <span className="text-muted-foreground font-medium">{parts.keyword}</span>{" "}
      <span className="text-primary font-semibold font-mono">
        {parts.variable}
      </span>{" "}
      <span className="text-foreground font-medium">{parts.operator}</span>
      {parts.value && (
        <>
          {" "}
          <span className="text-blue-600 dark:text-blue-400 font-medium">
            {parts.value}
          </span>
        </>
      )}
    </span>
  );
}
