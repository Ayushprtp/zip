import { useState, useMemo, useEffect } from "react";
import { Edit2, Check, Code2 } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { SmartTextareaField } from "../shared/SmartTextareaField";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";

export function FormDataEditor() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const formData = step?.request.request_data ?? null;
  const availableVariables = useMemo(() => {
    return step?.depends_on_variables || [];
  }, [step?.depends_on_variables]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");

  // Convert formData to string for editing
  useEffect(() => {
    if (formData === null) {
      setEditedText("");
    } else if (typeof formData === "string") {
      setEditedText(formData);
    } else if (typeof formData === "object") {
      // Convert object to form-encoded string or keep as string representation
      setEditedText(JSON.stringify(formData, null, 2));
    } else {
      setEditedText("");
    }
  }, [formData]);

  if (!step) return null;

  const disabled = isSaving;

  const handleStartEdit = () => {
    if (formData === null) {
      setEditedText("");
    } else if (typeof formData === "string") {
      setEditedText(formData);
    } else if (typeof formData === "object") {
      setEditedText(JSON.stringify(formData, null, 2));
    } else {
      setEditedText("");
    }
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!selectedStepNodeId) return;

    const trimmed = editedText.trim();
    if (!trimmed) {
      updateStep(selectedStepNodeId, {
        request: {
          ...step.request,
          request_data: null,
        },
      });
      setIsEditing(false);
      return;
    }

    // Try to parse as JSON first, if it fails, treat as string
    let newData: Record<string, any> | string | null = null;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) {
        newData = parsed;
      } else {
        newData = trimmed;
      }
    } catch {
      // Not valid JSON, treat as plain string
      newData = trimmed;
    }

    updateStep(selectedStepNodeId, {
      request: {
        ...step.request,
        request_data: newData,
      },
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (formData === null) {
      setEditedText("");
    } else if (typeof formData === "string") {
      setEditedText(formData);
    } else if (typeof formData === "object") {
      setEditedText(JSON.stringify(formData, null, 2));
    } else {
      setEditedText("");
    }
  };

  const displayText =
    formData === null
      ? null
      : typeof formData === "string"
        ? formData
        : JSON.stringify(formData, null, 2);

  return (
    <div className="space-y-3 w-full animate-in fade-in duration-200">
      {isEditing ? (
        <div className="space-y-3">
          <div className="relative">
            <SmartTextareaField
              value={editedText}
              onChange={setEditedText}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  handleSave();
                }
                if (e.key === "Escape") {
                  handleCancel();
                }
              }}
              placeholder="Enter form data or raw body..."
              className="font-mono text-sm min-h-[200px] max-h-[80vh] w-full resize-y rounded-lg border-2 p-4 border-primary/20 focus-visible:ring-primary"
              disabled={disabled}
              autoFocus
              availableVariables={availableVariables}
            />
            <div className="absolute top-3 right-3 text-xs text-muted-foreground bg-background px-1.5 rounded font-mono">
              FORM/TEXT
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={disabled}
              className="h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="default"
              onClick={handleSave}
              disabled={disabled}
              className="h-8"
            >
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Save Changes
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="relative group border rounded-lg w-full overflow-hidden hover:border-primary/50 transition-colors cursor-pointer bg-muted/10"
          onClick={handleStartEdit}
        >
          <div className="max-h-[80vh] min-h-[100px] p-4 overflow-y-auto overflow-x-auto w-full">
            {displayText ? (
              <div className="text-sm font-mono whitespace-pre-wrap break-all leading-relaxed text-foreground">
                {displayText}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-[80px] text-muted-foreground gap-2">
                <Code2 className="h-5 w-5 opacity-50" />
                <span className="text-xs">No data configured</span>
              </div>
            )}
          </div>

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs shadow-sm"
              disabled={disabled}
            >
              <Edit2 className="h-3.5 w-3.5 mr-1.5" />
              Edit Body
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
