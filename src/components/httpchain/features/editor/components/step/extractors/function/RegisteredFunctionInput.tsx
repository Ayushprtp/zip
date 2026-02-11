import { Input } from "@/components/httpchain/components/ui/input";
import { Label } from "@/components/httpchain/components/ui/label";
import { Package } from "lucide-react";

interface RegisteredFunctionInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function RegisteredFunctionInput({
  value,
  onChange,
  disabled,
}: RegisteredFunctionInputProps) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
        <Package className="h-3 w-3" />
        Registered Function Name
      </Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., find_registry_url, parse_bootstrap_data"
        disabled={disabled}
        className="h-9 font-mono text-sm"
      />
      <p className="text-[10px] text-muted-foreground/70">
        The function must be registered in the backend before execution. It will
        receive (response, variables) as arguments.
      </p>
    </div>
  );
}
