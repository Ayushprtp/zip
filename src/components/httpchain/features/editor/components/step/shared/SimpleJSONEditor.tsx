import { useState, useEffect } from "react";
import { Check, Edit2, Code2 } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { SmartTextareaField } from "./SmartTextareaField";
import { cn } from "@/components/httpchain/lib/utils";

interface SimpleJSONEditorProps {
  data: Record<string, any> | string | null;
  onUpdate: (data: Record<string, any> | null) => void;
  disabled?: boolean;
  availableVariables?: string[];
  emptyMessage?: string;
}

export function SimpleJSONEditor({
  data,
  onUpdate,
  disabled,
  availableVariables = [],
  emptyMessage = "No data configured",
}: SimpleJSONEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (data === null) {
        setEditedText("");
      } else if (typeof data === "string") {
        setEditedText(data);
      } else if (data && typeof data === "object") {
        setEditedText(JSON.stringify(data, null, 2));
      } else {
        setEditedText("");
      }
    } catch (_e) {
      setEditedText("");
    }
  }, [data]);

  const handleStartEdit = () => {
    if (data === null) {
      setEditedText("");
    } else if (typeof data === "string") {
      setEditedText(data);
    } else {
      setEditedText(JSON.stringify(data, null, 2));
    }
    setIsEditing(true);
    setError(null);
  };

  const handleSave = () => {
    setError(null);

    const trimmed = editedText.trim();
    if (!trimmed) {
      onUpdate(null);
      setIsEditing(false);
      return;
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed === null) {
        onUpdate(null);
      } else if (
        typeof parsed === "object" &&
        Object.keys(parsed).length === 0
      ) {
        onUpdate(null);
      } else {
        onUpdate(parsed);
      }
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    if (data === null) {
      setEditedText("");
    } else if (typeof data === "string") {
      setEditedText(data);
    } else {
      setEditedText(JSON.stringify(data, null, 2));
    }
  };

  const handleTextareaChange = (value: string) => {
    setEditedText(value);
    if (error) {
      setError(null);
    }
  };

  const displayText =
    data === null
      ? null
      : typeof data === "string"
        ? data
        : JSON.stringify(data, null, 2);

  return (
    <div className="space-y-3 w-full animate-in fade-in duration-200">
      {isEditing ? (
        <div className="space-y-3">
          <div className="relative">
            <SmartTextareaField
              value={editedText}
              onChange={handleTextareaChange}
              placeholder="Enter JSON..."
              className={cn(
                "font-mono text-sm min-h-[200px] max-h-[80vh] w-full resize-y rounded-lg border-2 p-4",
                error
                  ? "border-destructive focus-visible:ring-destructive"
                  : "border-primary/20 focus-visible:ring-primary",
              )}
              disabled={disabled}
              autoFocus
              availableVariables={availableVariables}
            />
            <div className="absolute top-3 right-3 text-xs text-muted-foreground bg-background px-1.5 rounded font-mono">
              JSON
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-md font-medium">
              <span>Error: {error}</span>
            </div>
          )}

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
              disabled={disabled || !!error}
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
                <span className="text-xs">{emptyMessage}</span>
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
              Edit JSON
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
