import { useState, useMemo } from "react";
import { Edit2, Check, X } from "lucide-react";
import { Button } from "@/components/httpchain/components/ui/button";
import { SmartInputField } from "../shared/SmartInputField";
import { Label } from "@/components/httpchain/components/ui/label";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";

export function ProxySettings() {
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const isSaving = useAppStore((s) => s.isSaving);
  const updateStep = useAppStore((s) => s.updateStep);

  const request = step?.request;
  const availableVariables = useMemo(() => {
    return step?.depends_on_variables || [];
  }, [step?.depends_on_variables]);

  const disabled = isSaving;

  const [isEditingHttp, setIsEditingHttp] = useState(false);
  const [editedHttp, setEditedHttp] = useState("");
  const [isEditingHttps, setIsEditingHttps] = useState(false);
  const [editedHttps, setEditedHttps] = useState("");

  if (!step || !request) return null;

  const handleStartEditHttp = () => {
    setEditedHttp(request.request_http_proxy || "");
    setIsEditingHttp(true);
  };

  const handleSaveHttp = () => {
    if (!selectedStepNodeId) return;
    const value = editedHttp.trim();
    if (value !== (request.request_http_proxy || "")) {
      updateStep(selectedStepNodeId, {
        request: {
          ...request,
          request_http_proxy: value || null,
        },
      });
    }
    setIsEditingHttp(false);
  };

  const handleCancelEditHttp = () => {
    setIsEditingHttp(false);
    setEditedHttp("");
  };

  const handleStartEditHttps = () => {
    setEditedHttps(request.request_https_proxy || "");
    setIsEditingHttps(true);
  };

  const handleSaveHttps = () => {
    if (!selectedStepNodeId) return;
    const value = editedHttps.trim();
    if (value !== (request.request_https_proxy || "")) {
      updateStep(selectedStepNodeId, {
        request: {
          ...request,
          request_https_proxy: value || null,
        },
      });
    }
    setIsEditingHttps(false);
  };

  const handleCancelEditHttps = () => {
    setIsEditingHttps(false);
    setEditedHttps("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-24 shrink-0">
          HTTP Proxy
        </Label>
        {isEditingHttp ? (
          <div className="flex items-center gap-1 flex-1">
            <SmartInputField
              value={editedHttp}
              onChange={setEditedHttp}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveHttp();
                if (e.key === "Escape") handleCancelEditHttp();
              }}
              placeholder="http://proxy:port"
              className="h-7 text-xs"
              autoFocus
              disabled={disabled}
              availableVariables={availableVariables}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSaveHttp}
              disabled={disabled}
              className="h-7 w-7 shrink-0"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancelEditHttp}
              disabled={disabled}
              className="h-7 w-7 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group flex-1">
            <span className="text-xs truncate">
              {request.request_http_proxy || (
                <span className="text-muted-foreground">Not configured</span>
              )}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={handleStartEditHttp}
              disabled={disabled}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide w-24 shrink-0">
          HTTPS Proxy
        </Label>
        {isEditingHttps ? (
          <div className="flex items-center gap-1 flex-1">
            <SmartInputField
              value={editedHttps}
              onChange={setEditedHttps}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveHttps();
                if (e.key === "Escape") handleCancelEditHttps();
              }}
              placeholder="https://proxy:port"
              className="h-7 text-xs"
              autoFocus
              disabled={disabled}
              availableVariables={availableVariables}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSaveHttps}
              disabled={disabled}
              className="h-7 w-7 shrink-0"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCancelEditHttps}
              disabled={disabled}
              className="h-7 w-7 shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 group flex-1">
            <span className="text-xs truncate">
              {request.request_https_proxy || (
                <span className="text-muted-foreground">Not configured</span>
              )}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={handleStartEditHttps}
              disabled={disabled}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
