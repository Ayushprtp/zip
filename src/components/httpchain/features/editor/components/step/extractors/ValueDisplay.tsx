import { Badge } from "@/components/httpchain/components/ui/badge";

interface ValueDisplayProps {
  value: any;
}

export function ValueDisplay({ value }: ValueDisplayProps) {
  const getValueDisplay = () => {
    if (value === true || value === "true") {
      return {
        text: "True",
        variant: "default" as const,
        className: "bg-green-600 hover:bg-green-600 text-white",
      };
    }
    if (value === false || value === "false") {
      return {
        text: "False",
        variant: "default" as const,
        className: "bg-red-600 hover:bg-red-600 text-white",
      };
    }
    if (value === null || value === "null" || value === undefined) {
      return {
        text: "Null",
        variant: "secondary" as const,
        className: "bg-gray-500 hover:bg-gray-500 text-white",
      };
    }
    if (typeof value === "number") {
      return {
        text: String(value),
        variant: "default" as const,
        className: "bg-blue-600 hover:bg-blue-600 text-white",
      };
    }
    return { text: String(value), variant: "outline" as const, className: "" };
  };

  const display = getValueDisplay();

  return (
    <Badge variant={display.variant} className={`text-xs ${display.className}`}>
      {display.text}
    </Badge>
  );
}
