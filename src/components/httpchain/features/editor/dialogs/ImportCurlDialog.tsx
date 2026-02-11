import { useState } from "react";
import { Terminal, AlertTriangle, Loader2, FileCode2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { parseCurl, type CurlParseResult } from "@/app/actions/httpchain";
import { toast } from "../../../lib/toast";
import { useAppStore } from "@/components/httpchain/store";
import { useActiveStep } from "@/components/httpchain/features/editor/hooks/useActiveStep";

interface ImportCurlDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCurlDialog({
  open,
  onOpenChange,
}: ImportCurlDialogProps) {
  // Subscribe to store directly (following the codebase pattern)
  const step = useActiveStep();
  const selectedStepNodeId = useAppStore((s) => s.selectedStepNodeId);
  const updateStep = useAppStore((s) => s.updateStep);
  const isSaving = useAppStore((s) => s.isSaving);

  const [curlCommand, setCurlCommand] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!curlCommand.trim() || !selectedStepNodeId || !step) return;

    setIsImporting(true);
    setParseError(null);

    try {
      const result: CurlParseResult = await parseCurl(curlCommand.trim());

      if (!result.success || !result.request) {
        setParseError(result.error || "Failed to parse cURL command");
        setIsImporting(false);
        return;
      }

      // Update step directly via store (following the pattern)
      const request = result.request;
      updateStep(selectedStepNodeId, {
        request: {
          ...step.request,
          request_method: request.request_method || step.request.request_method,
          request_url: request.request_url || step.request.request_url,
          request_headers:
            request.request_headers || step.request.request_headers,
          request_cookies: request.request_cookies,
          request_params: request.request_params,
          request_json: request.request_json,
          request_data: request.request_data,
        },
      });

      toast.success("cURL imported", "Request configuration has been updated");
      setCurlCommand("");
      onOpenChange(false);
    } catch (error) {
      setParseError(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    setCurlCommand("");
    setParseError(null);
  };

  const disabled = isSaving || isImporting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Import from cURL</DialogTitle>
              <DialogDescription>
                Paste a cURL command to auto-populate request settings
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning Banner */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">This will overwrite existing data</p>
              <p className="text-xs mt-0.5 opacity-80">
                Headers, cookies, params, and body will be replaced with values
                from the cURL command.
              </p>
            </div>
          </div>

          {/* cURL Input */}
          <div className="space-y-2">
            <Label htmlFor="curl-command" className="flex items-center gap-2">
              <FileCode2 className="h-3.5 w-3.5" />
              cURL Command
            </Label>
            <textarea
              id="curl-command"
              value={curlCommand}
              onChange={(e) => {
                setCurlCommand(e.target.value);
                setParseError(null);
              }}
              placeholder={`curl -X POST https://api.example.com/data \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer token123" \\
  -d '{"key": "value"}'`}
              className="w-full h-48 px-3 py-2 text-sm font-mono bg-muted/50 border border-input rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 placeholder:text-muted-foreground/50"
              autoFocus
              disabled={disabled}
            />
            {parseError && (
              <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1">
                {parseError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Tip: Copy cURL from browser DevTools (Network tab → Right-click →
              Copy as cURL)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={disabled}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!curlCommand.trim() || disabled}
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Terminal className="h-4 w-4 mr-2" />
                Import cURL
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
