import { useState, useEffect } from "react";
import { Server, ArrowRight, Globe, CheckCircle2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { useAppStore } from "../../store";
import { Card, CardContent } from "../../components/ui/card";
import { cn } from "../../lib/utils";

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

interface BackendUrlDialogProps {
  open: boolean;
  onClose: () => void;
}

export function BackendUrlDialog({ open, onClose }: BackendUrlDialogProps) {
  const backendUrl = useAppStore((s) => s.backendUrl);
  const setBackendUrl = useAppStore((s) => s.setBackendUrl);

  const [url, setUrl] = useState(backendUrl || "http://localhost:8000");
  const [error, setError] = useState<string | null>(null);

  // Sync with store value when dialog opens
  useEffect(() => {
    if (open) {
      setUrl(backendUrl || "http://localhost:8000");
      setError(null);
    }
  }, [open, backendUrl]);

  const handleSubmit = () => {
    const trimmedUrl = url.trim().replace(/\/+$/, "");

    if (!trimmedUrl) {
      setError("Please enter a URL");
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      setError("Please enter a valid URL (e.g., http://localhost:8000)");
      return;
    }

    setBackendUrl(trimmedUrl);
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Server className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Connect to Backend</DialogTitle>
              <DialogDescription className="mt-1">
                Configure the HTTPChain execution server
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Globe className="h-4 w-4 text-primary" />
                Server URL
              </div>
              <div className="space-y-2">
                <Input
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  placeholder="http://localhost:8000"
                  className={cn(
                    "font-mono text-sm bg-background transition-all",
                    error
                      ? "border-destructive focus-visible:ring-destructive"
                      : "",
                  )}
                  autoFocus
                />
                {error ? (
                  <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1">
                    {error}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    The URL where your HTTPChain backend is running
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {backendUrl && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-green-500/10 px-3 py-2 rounded-lg border border-green-500/20 text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Current active connection:{" "}
              <span className="font-mono font-medium">{backendUrl}</span>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 pt-2 bg-muted/20">
          <div className="flex gap-2 w-full">
            <Button variant="ghost" onClick={handleSkip} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!url.trim()}
              className="flex-1"
            >
              Save Configuration
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
