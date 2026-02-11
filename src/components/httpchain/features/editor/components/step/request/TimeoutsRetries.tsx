import { useState } from "react";
import { Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { Input } from "@/components/httpchain/components/ui/input";
import { Label } from "@/components/httpchain/components/ui/label";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";

type EditField = "connect" | "read" | "retries" | "delay" | null;

// Validation constants
const MAX_TIMEOUT_MS = 300000; // 5 minutes
const MAX_RETRIES = 10;
const MAX_DELAY_MS = 60000; // 1 minute
const MIN_VALUE = 0;

interface FieldConfig {
  min: number;
  max: number;
  defaultValue: number;
  getCurrentValue: (request: any) => number;
  fieldName: string;
}

const FIELD_CONFIGS: Record<Exclude<EditField, null>, FieldConfig> = {
  connect: {
    min: MIN_VALUE,
    max: MAX_TIMEOUT_MS,
    defaultValue: 10000,
    getCurrentValue: (r) => r.request_connect_timeout || 10000,
    fieldName: "request_connect_timeout",
  },
  read: {
    min: MIN_VALUE,
    max: MAX_TIMEOUT_MS,
    defaultValue: 10000,
    getCurrentValue: (r) => r.request_read_timeout || 10000,
    fieldName: "request_read_timeout",
  },
  retries: {
    min: MIN_VALUE,
    max: MAX_RETRIES,
    defaultValue: 3,
    getCurrentValue: (r) => r.request_retries ?? 3,
    fieldName: "request_retries",
  },
  delay: {
    min: MIN_VALUE,
    max: MAX_DELAY_MS,
    defaultValue: 1000,
    getCurrentValue: (r) => r.request_retry_delay ?? 1000,
    fieldName: "request_retry_delay",
  },
};

export function TimeoutsRetries() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  if (!step) return null;

  const request = step.request;
  const disabled = isSaving;
  const [editingField, setEditingField] = useState<EditField>(null);
  const [editedValue, setEditedValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleStartEdit = (field: EditField, currentValue: number) => {
    setEditingField(field);
    setEditedValue(String(currentValue));
    setError(null);
  };

  const validateValue = (
    field: EditField,
    value: string,
  ): { isValid: boolean; numValue: number; error: string | null } => {
    if (!field || field === null) {
      return { isValid: false, numValue: 0, error: "Invalid field" };
    }

    const config = FIELD_CONFIGS[field as Exclude<EditField, null>];
    if (!config) {
      return {
        isValid: false,
        numValue: 0,
        error: "Invalid field configuration",
      };
    }

    // Check if empty
    if (!value.trim()) {
      return { isValid: false, numValue: 0, error: "Value cannot be empty" };
    }

    // Parse number
    const numValue = parseInt(value.trim(), 10);

    // Check if valid number
    if (isNaN(numValue)) {
      return { isValid: false, numValue: 0, error: "Must be a valid number" };
    }

    // Check if negative
    if (numValue < config.min) {
      return {
        isValid: false,
        numValue,
        error: `Must be at least ${config.min}`,
      };
    }

    // Check if exceeds maximum
    if (numValue > config.max) {
      return {
        isValid: false,
        numValue,
        error: `Must be at most ${config.max}`,
      };
    }

    return { isValid: true, numValue, error: null };
  };

  const handleSave = (field: EditField) => {
    if (!selectedStepNodeId || !field) return;

    const validation = validateValue(field, editedValue);

    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    const config = FIELD_CONFIGS[field as Exclude<EditField, null>];
    if (!config) return;

    const currentValue = config.getCurrentValue(request);

    // Only update if value changed
    if (validation.numValue !== currentValue) {
      updateStep(selectedStepNodeId, {
        request: {
          ...request,
          [config.fieldName]: validation.numValue,
        },
      });
    }

    setEditingField(null);
    setError(null);
    setEditedValue("");
  };

  const handleCancel = () => {
    setEditingField(null);
    setEditedValue("");
    setError(null);
  };

  const renderEditableField = (
    field: Exclude<EditField, null>,
    label: string,
    unit: string = "",
    showUnit: boolean = true,
  ) => {
    const config = FIELD_CONFIGS[field];
    if (!config) return null;

    const currentValue = config.getCurrentValue(request);
    const isEditing = editingField === field;
    const fieldError = isEditing && error ? error : null;

    if (isEditing) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {label}
            </Label>
            <div className="flex items-center gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => handleSave(field)}
                disabled={disabled || !!fieldError || !editedValue.trim()}
                className="h-6 w-6"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancel}
                disabled={disabled}
                className="h-6 w-6"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={editedValue}
              onChange={(e) => {
                setEditedValue(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave(field);
                if (e.key === "Escape") handleCancel();
              }}
              min={config.min}
              max={config.max}
              className={`h-8 text-sm ${fieldError ? "border-destructive" : ""}`}
              autoFocus
              disabled={disabled}
            />
            {showUnit && (
              <span className="text-xs text-muted-foreground shrink-0">
                {unit}
              </span>
            )}
          </div>
          {fieldError && (
            <p className="text-[10px] text-destructive">{fieldError}</p>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-16 shrink-0">
          {label}
        </Label>
        <div className="flex items-center gap-1 group flex-1">
          <span className="text-xs font-mono">{currentValue}</span>
          {showUnit && (
            <span className="text-[10px] text-muted-foreground">{unit}</span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={() => handleStartEdit(field, currentValue)}
            disabled={disabled}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {renderEditableField("connect", "Connect", "ms")}
      {renderEditableField("read", "Read", "ms")}
      {renderEditableField("retries", "Retries", "", false)}
      {renderEditableField("delay", "Delay", "ms")}
    </div>
  );
}
