import { useState, useMemo } from "react";
import { Edit2, Check, X, Globe, Link } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { Input } from "@/components/httpchain/components/ui/input";
import { SmartInputField } from "../shared/SmartInputField";
import { cn } from "@/components/httpchain/lib/utils";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";
import type { HTTPMethod } from "@/components/httpchain/types/schema";

const HTTP_METHODS: HTTPMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD",
  "OPTIONS",
];

const METHOD_COLORS: Record<HTTPMethod, string> = {
  GET: "text-green-600 dark:text-green-500",
  POST: "text-yellow-600 dark:text-yellow-500",
  PUT: "text-blue-600 dark:text-blue-500",
  DELETE: "text-red-600 dark:text-red-500",
  PATCH: "text-purple-600 dark:text-purple-500",
  HEAD: "text-gray-600 dark:text-gray-500",
  OPTIONS: "text-gray-600 dark:text-gray-500",
};

export function RequestBasicInfo() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const request = step?.request;
  const availableVariables = useMemo(() => {
    return step?.depends_on_variables || [];
  }, [step?.depends_on_variables]);

  const disabled = isSaving;

  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editedUrl, setEditedUrl] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  if (!step || !request) return null;

  const handleStartEditUrl = () => {
    setEditedUrl(request.request_url);
    setIsEditingUrl(true);
  };

  const handleSaveUrl = () => {
    if (!selectedStepNodeId) return;
    if (editedUrl.trim() !== request.request_url) {
      updateStep(selectedStepNodeId, {
        request: {
          ...request,
          request_url: editedUrl.trim(),
        },
      });
    }
    setIsEditingUrl(false);
  };

  const handleCancelEditUrl = () => {
    setIsEditingUrl(false);
    setEditedUrl("");
  };

  const handleStartEditName = () => {
    setEditedName(request.request_name);
    setIsEditingName(true);
  };

  const handleSaveName = () => {
    if (!selectedStepNodeId) return;
    if (editedName.trim() !== request.request_name) {
      updateStep(selectedStepNodeId, {
        request: {
          ...request,
          request_name: editedName.trim(),
        },
      });
    }
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName("");
  };

  const handleUpdateMethod = (method: HTTPMethod) => {
    if (!selectedStepNodeId) return;
    updateStep(selectedStepNodeId, {
      request: {
        ...request,
        request_method: method,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Endpoint Details</h3>
      </div>

      <div className="space-y-4 pl-2">
        {/* Request Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Request Name
          </label>
          <div className="flex items-center gap-2">
            {isEditingName ? (
              <div className="flex items-center gap-2 w-full max-w-md animate-in fade-in duration-200">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") handleCancelEditName();
                  }}
                  placeholder="Request name"
                  className="h-8 text-sm"
                  autoFocus
                  disabled={disabled}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSaveName}
                  disabled={disabled || !editedName.trim()}
                  className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancelEditName}
                  disabled={disabled}
                  className="h-8 w-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group flex-1">
                <span className="text-sm font-medium">
                  {request.request_name || (
                    <span className="text-muted-foreground italic">
                      Unnamed request
                    </span>
                  )}
                </span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all shrink-0 hover:bg-muted"
                  onClick={handleStartEditName}
                  disabled={disabled}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* URL Bar - Postman style */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            URL
          </label>
          <div className="flex gap-0 items-center bg-background border rounded-lg shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all overflow-hidden">
            <div className="border-r bg-muted/30 px-1">
              <select
                value={request.request_method}
                onChange={(e) =>
                  handleUpdateMethod(e.target.value as HTTPMethod)
                }
                disabled={disabled || isEditingUrl}
                className={cn(
                  "h-10 rounded-none border-0 bg-transparent px-3 text-sm font-bold focus-visible:outline-none cursor-pointer hover:bg-muted/50 transition-colors",
                  METHOD_COLORS[request.request_method],
                )}
              >
                {HTTP_METHODS.map((method) => (
                  <option
                    key={method}
                    value={method}
                    className="text-foreground bg-background font-medium"
                  >
                    {method}
                  </option>
                ))}
              </select>
            </div>

            {isEditingUrl ? (
              <div className="flex-1 flex items-center pr-1">
                <SmartInputField
                  value={editedUrl}
                  onChange={setEditedUrl}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveUrl();
                    if (e.key === "Escape") handleCancelEditUrl();
                  }}
                  placeholder="https://api.example.com/endpoint"
                  className="h-10 font-mono text-sm border-0 bg-transparent focus-visible:ring-0 px-3 rounded-none"
                  autoFocus
                  disabled={disabled}
                  availableVariables={availableVariables}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleSaveUrl}
                  disabled={disabled || !editedUrl.trim()}
                  className="h-8 w-8 shrink-0 mr-1 hover:bg-primary/10 hover:text-primary"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleCancelEditUrl}
                  disabled={disabled}
                  className="h-8 w-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div
                className="flex-1 flex items-center gap-2 group h-10 px-3 cursor-text hover:bg-muted/10 transition-colors"
                onClick={handleStartEditUrl}
              >
                <span className="font-mono text-sm truncate flex-1 text-foreground">
                  {request.request_url || (
                    <span className="text-muted-foreground italic">
                      Enter request URL...
                    </span>
                  )}
                </span>
                <Link className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
