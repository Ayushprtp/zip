import type { DeclarativeCheck } from "@/components/httpchain/types/schema";
import { DeclarativeOperator as DeclarativeOperatorEnum } from "@/components/httpchain/types/schema";

export interface CheckDisplayParts {
  keyword: string;
  variable: string;
  operator: string;
  value?: string;
}

/**
 * Convert a DeclarativeCheck to display parts for semantic highlighting
 */
export function getCheckDisplayParts(
  check: DeclarativeCheck,
): CheckDisplayParts {
  const variableName = check.variable_name || "variable";

  if (!check.operator) {
    return {
      keyword: "if",
      variable: variableName,
      operator: "(invalid)",
    };
  }

  switch (check.operator) {
    case DeclarativeOperatorEnum.EXISTS:
      return {
        keyword: "if",
        variable: variableName,
        operator: "exists",
      };

    case DeclarativeOperatorEnum.NOT_EXISTS:
      return {
        keyword: "if",
        variable: variableName,
        operator: "does not exist",
      };

    case DeclarativeOperatorEnum.EQUALS:
      return {
        keyword: "if",
        variable: variableName,
        operator: "equals",
        value:
          check.value !== undefined && check.value !== null
            ? formatValue(check.value)
            : undefined,
      };

    case DeclarativeOperatorEnum.NOT_EQUALS:
      return {
        keyword: "if",
        variable: variableName,
        operator: "does not equal",
        value:
          check.value !== undefined && check.value !== null
            ? formatValue(check.value)
            : undefined,
      };

    case DeclarativeOperatorEnum.CONTAINS:
      return {
        keyword: "if",
        variable: variableName,
        operator: "contains",
        value:
          check.value !== undefined && check.value !== null
            ? formatValue(check.value)
            : undefined,
      };

    case DeclarativeOperatorEnum.NOT_CONTAINS:
      return {
        keyword: "if",
        variable: variableName,
        operator: "does not contain",
        value:
          check.value !== undefined && check.value !== null
            ? formatValue(check.value)
            : undefined,
      };

    case DeclarativeOperatorEnum.CONTAINS_PATTERN:
      return {
        keyword: "if",
        variable: variableName,
        operator: "contains pattern",
        value:
          check.value !== undefined && check.value !== null
            ? formatValue(check.value)
            : undefined,
      };

    case DeclarativeOperatorEnum.NOT_CONTAINS_PATTERN:
      return {
        keyword: "if",
        variable: variableName,
        operator: "does not contain pattern",
        value:
          check.value !== undefined && check.value !== null
            ? formatValue(check.value)
            : undefined,
      };

    case DeclarativeOperatorEnum.IS_GREATER_THAN:
      return {
        keyword: "if",
        variable: variableName,
        operator: "is greater than",
        value:
          check.value !== undefined && check.value !== null
            ? formatValue(check.value)
            : undefined,
      };

    case DeclarativeOperatorEnum.IS_LESS_THAN:
      return {
        keyword: "if",
        variable: variableName,
        operator: "is less than",
        value:
          check.value !== undefined && check.value !== null
            ? formatValue(check.value)
            : undefined,
      };

    default:
      return {
        keyword: "if",
        variable: variableName,
        operator: check.operator,
      };
  }
}

/**
 * Convert a DeclarativeCheck to a human-readable string (for backwards compatibility)
 */
export function humanizeCheck(check: DeclarativeCheck): string {
  const variableName = check.variable_name || "variable";

  if (!check.operator) {
    return `if ${variableName} (invalid)`;
  }

  switch (check.operator) {
    case DeclarativeOperatorEnum.EXISTS:
      return `if ${variableName} exists`;

    case DeclarativeOperatorEnum.NOT_EXISTS:
      return `if ${variableName} does not exist`;

    case DeclarativeOperatorEnum.EQUALS:
      if (check.value !== undefined && check.value !== null) {
        return `if ${variableName} equals ${formatValue(check.value)}`;
      }
      return `if ${variableName} equals (no value)`;

    case DeclarativeOperatorEnum.NOT_EQUALS:
      if (check.value !== undefined && check.value !== null) {
        return `if ${variableName} does not equal ${formatValue(check.value)}`;
      }
      return `if ${variableName} does not equal (no value)`;

    case DeclarativeOperatorEnum.CONTAINS:
      if (check.value !== undefined && check.value !== null) {
        return `if ${variableName} contains ${formatValue(check.value)}`;
      }
      return `if ${variableName} contains (no value)`;

    case DeclarativeOperatorEnum.NOT_CONTAINS:
      if (check.value !== undefined && check.value !== null) {
        return `if ${variableName} does not contain ${formatValue(check.value)}`;
      }
      return `if ${variableName} does not contain (no value)`;

    case DeclarativeOperatorEnum.CONTAINS_PATTERN:
      if (check.value !== undefined && check.value !== null) {
        return `if ${variableName} contains pattern ${formatValue(check.value)}`;
      }
      return `if ${variableName} contains pattern (no value)`;

    case DeclarativeOperatorEnum.NOT_CONTAINS_PATTERN:
      if (check.value !== undefined && check.value !== null) {
        return `if ${variableName} does not contain pattern ${formatValue(check.value)}`;
      }
      return `if ${variableName} does not contain pattern (no value)`;

    case DeclarativeOperatorEnum.IS_GREATER_THAN:
      if (check.value !== undefined && check.value !== null) {
        return `if ${variableName} is greater than ${formatValue(check.value)}`;
      }
      return `if ${variableName} is greater than (no value)`;

    case DeclarativeOperatorEnum.IS_LESS_THAN:
      if (check.value !== undefined && check.value !== null) {
        return `if ${variableName} is less than ${formatValue(check.value)}`;
      }
      return `if ${variableName} is less than (no value)`;

    default:
      return `if ${variableName} ${check.operator}`;
  }
}

function formatValue(value: any): string {
  if (value === null) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "string") {
    // Truncate long strings
    if (value.length > 50) {
      return `"${value.substring(0, 47)}..."`;
    }
    return `"${value}"`;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return String(value);
}
