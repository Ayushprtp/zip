import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/httpchain/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/httpchain/components/ui/select";
import { PathBuilder } from "./PathBuilder";
import { ValueSelector } from "./ValueSelector";
import type {
  DeclarativeCheck,
  DeclarativeOperator,
} from "@/components/httpchain/types/schema";
import { DeclarativeOperator as DeclarativeOperatorEnum } from "@/components/httpchain/types/schema";

interface DeclarativeCheckExtractorProps {
  value: DeclarativeCheck;
  onChange: (value: DeclarativeCheck) => void;
  disabled?: boolean;
  // Flags to control which fields are shown
  showPath?: boolean; // For extractor mode: path required, variable NOT allowed
  showVariable?: boolean; // For condition mode: variable required, path NOT allowed
  availableVariables?: string[]; // Available variables for condition mode (step dependencies)
}

export function DeclarativeCheckExtractor({
  value,
  onChange,
  disabled,
  showPath = true,
  showVariable = false,
  availableVariables = [],
}: DeclarativeCheckExtractorProps) {
  const [operator, setOperator] = useState<DeclarativeOperator>(value.operator);
  const [checkValue, setCheckValue] = useState(value.value);
  const [variableName, setVariableName] = useState(value.variable_name || "");
  const [path, setPath] = useState<string[]>(value.path || []);

  // Use ref to store onChange to avoid dependency issues
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Operators that don't need a value
  const operatorsWithoutValue: DeclarativeOperator[] = [
    DeclarativeOperatorEnum.EXISTS,
    DeclarativeOperatorEnum.NOT_EXISTS,
  ];

  const needsValue = !operatorsWithoutValue.includes(operator);

  useEffect(() => {
    const newValue: DeclarativeCheck = {
      operator,
      // Path is required - use empty array if showPath is false or path is empty
      path: showPath ? (path.length > 0 ? path : []) : [],
      // Include value if it's needed and not undefined/null (empty string is allowed)
      ...(needsValue && checkValue !== undefined && checkValue !== null
        ? { value: checkValue }
        : {}),
      // Include variable_name only if showVariable is true and variableName exists
      ...(showVariable && variableName ? { variable_name: variableName } : {}),
    };
    onChangeRef.current(newValue);
  }, [
    path,
    operator,
    checkValue,
    variableName,
    needsValue,
    showPath,
    showVariable,
  ]);

  return (
    <div className="space-y-4">
      {showPath && (
        <PathBuilder
          value={path}
          onChange={setPath}
          disabled={disabled}
          label="Path"
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="operator">Operator</Label>
        <Select
          value={operator}
          onValueChange={(v) => setOperator(v as DeclarativeOperator)}
          disabled={disabled}
        >
          <SelectTrigger id="operator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DeclarativeOperatorEnum.EXISTS}>
              Exists
            </SelectItem>
            <SelectItem value={DeclarativeOperatorEnum.NOT_EXISTS}>
              Not Exists
            </SelectItem>
            <SelectItem value={DeclarativeOperatorEnum.EQUALS}>
              Equals
            </SelectItem>
            <SelectItem value={DeclarativeOperatorEnum.NOT_EQUALS}>
              Not Equals
            </SelectItem>
            <SelectItem value={DeclarativeOperatorEnum.CONTAINS}>
              Contains
            </SelectItem>
            <SelectItem value={DeclarativeOperatorEnum.CONTAINS_PATTERN}>
              Contains Pattern
            </SelectItem>
            <SelectItem value={DeclarativeOperatorEnum.NOT_CONTAINS}>
              Not Contains
            </SelectItem>
            <SelectItem value={DeclarativeOperatorEnum.NOT_CONTAINS_PATTERN}>
              Not Contains Pattern
            </SelectItem>
            <SelectItem value={DeclarativeOperatorEnum.IS_GREATER_THAN}>
              Is Greater Than
            </SelectItem>
            <SelectItem value={DeclarativeOperatorEnum.IS_LESS_THAN}>
              Is Less Than
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {needsValue && (
        <ValueSelector
          value={checkValue}
          onChange={setCheckValue}
          disabled={disabled}
          operator={operator}
        />
      )}

      {showVariable && (
        <div className="space-y-2">
          <Label htmlFor="variable_name">Variable Name</Label>
          <Select
            value={variableName}
            onValueChange={(v) => setVariableName(v)}
            disabled={disabled}
          >
            <SelectTrigger id="variable_name">
              <SelectValue
                placeholder={
                  availableVariables.length > 0
                    ? "Select variable"
                    : "No dependencies available"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableVariables.length > 0 ? (
                availableVariables.map((variable) => (
                  <SelectItem key={variable} value={variable}>
                    {variable}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  No dependencies available. Add variables in Step Dependencies
                  first.
                </div>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {availableVariables.length > 0
              ? "The variable to check against (must be in step dependencies)"
              : "You must add variables to Step Dependencies before creating conditions"}
          </p>
        </div>
      )}
    </div>
  );
}
