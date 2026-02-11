import { useState, useEffect } from "react";
import { Label } from "@/components/httpchain/components/ui/label";
import { Input } from "@/components/httpchain/components/ui/input";
import { Checkbox } from "@/components/httpchain/components/ui/checkbox";
import { PathBuilder } from "./PathBuilder";
import type { RegexExtractor } from "@/components/httpchain/types/schema";

interface RegexExtractorProps {
  value: RegexExtractor;
  onChange: (value: RegexExtractor) => void;
  disabled?: boolean;
}

export function RegexExtractorForm({
  value,
  onChange,
  disabled,
}: RegexExtractorProps) {
  const [path, setPath] = useState<string[]>(value.path || []);
  const [pattern, setPattern] = useState(value.pattern || "");
  const [findAll, setFindAll] = useState(value.find_all || false);

  useEffect(() => {
    onChange({
      path,
      pattern,
      find_all: findAll,
    });
  }, [path, pattern, findAll, onChange]);

  return (
    <div className="space-y-4">
      <PathBuilder
        value={path}
        onChange={setPath}
        disabled={disabled}
        label="Path"
      />

      <div className="space-y-2">
        <Label htmlFor="pattern">Regex Pattern</Label>
        <Input
          id="pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="\\d+"
          disabled={disabled}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Regular expression pattern (e.g., \\d+ for numbers)
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="find_all"
          checked={findAll}
          onCheckedChange={(checked) => setFindAll(checked === true)}
          disabled={disabled}
        />
        <Label
          htmlFor="find_all"
          className="text-sm font-normal cursor-pointer"
        >
          Find all matches
        </Label>
      </div>
    </div>
  );
}
