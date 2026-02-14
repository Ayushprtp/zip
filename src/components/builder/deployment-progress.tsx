/**
 * DeploymentProgress Component
 *
 * Displays deployment status updates with progress indicator.
 * Shows final URL when deployment completes and handles errors.
 *
 * Requirements: 14.5
 */

"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Rocket,
} from "lucide-react";
import type { DeploymentStatus } from "@/lib/builder/deployment-service";

interface DeploymentProgressProps {
  open: boolean;
  onClose: () => void;
  status: DeploymentStatus | null;
  deploymentUrl?: string;
  error?: string;
  buildLogs?: string[];
}

export function DeploymentProgress({
  open,
  onClose,
  status,
  deploymentUrl,
  error,
  buildLogs,
}: DeploymentProgressProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyUrl = () => {
    if (deploymentUrl) {
      navigator.clipboard.writeText(deploymentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenUrl = () => {
    if (deploymentUrl) {
      window.open(deploymentUrl, "_blank", "noopener,noreferrer");
    }
  };

  const isComplete = status?.status === "success";
  const hasError = status?.status === "error" || !!error;
  const isInProgress = status && !isComplete && !hasError;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Deployment
          </DialogTitle>
          <DialogDescription>
            {isComplete && "Your project has been deployed successfully!"}
            {hasError && "Deployment failed"}
            {isInProgress && "Deploying your project..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Indicator */}
          {isInProgress && status && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{status.message}</span>
                <span className="font-medium">{status.progress}%</span>
              </div>
              <Progress value={status.progress} className="h-2" />
            </div>
          )}

          {/* Status Messages */}
          {status && (
            <div className="space-y-2">
              {status.status === "preparing" && (
                <StatusItem
                  icon={<Loader2 className="h-4 w-4 animate-spin" />}
                  text="Preparing deployment package"
                  active
                />
              )}
              {(status.status === "uploading" || status.progress! >= 30) && (
                <StatusItem
                  icon={
                    status.status === "uploading" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )
                  }
                  text="Uploading files"
                  active={status.status === "uploading"}
                />
              )}
              {(status.status === "building" || status.progress! >= 60) && (
                <StatusItem
                  icon={
                    status.status === "building" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )
                  }
                  text="Building project"
                  active={status.status === "building"}
                />
              )}
              {(status.status === "deploying" || status.progress! >= 80) && (
                <StatusItem
                  icon={
                    status.status === "deploying" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )
                  }
                  text="Deploying to production"
                  active={status.status === "deploying"}
                />
              )}
            </div>
          )}

          {/* Success State */}
          {isComplete && deploymentUrl && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="space-y-3">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Deployment successful!
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-green-100 dark:bg-green-900 px-2 py-1 text-xs text-green-900 dark:text-green-100 break-all">
                    {deploymentUrl}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyUrl}
                    className="shrink-0"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={handleOpenUrl}
                  className="w-full"
                  variant="default"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Deployment
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Error State */}
          {hasError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Deployment failed</p>
                <p className="mt-1 text-sm">
                  {error || status?.message || "An unknown error occurred"}
                </p>
              </AlertDescription>
            </Alert>
          )}

          {/* Build Logs (shown on error) */}
          {hasError && buildLogs && buildLogs.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Build Logs
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg bg-zinc-950 border border-zinc-800 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                {buildLogs.map((line, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap break-all ${
                      line.toLowerCase().includes("error")
                        ? "text-red-400 font-semibold"
                        : line.toLowerCase().includes("warn")
                          ? "text-yellow-400"
                          : ""
                    }`}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2">
          {isComplete && (
            <Button onClick={onClose} variant="default">
              Done
            </Button>
          )}
          {hasError && (
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          )}
          {isInProgress && (
            <Button onClick={onClose} variant="ghost" disabled>
              Deploying...
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * StatusItem Component
 *
 * Displays a single status item with icon and text
 */
interface StatusItemProps {
  icon: React.ReactNode;
  text: string;
  active?: boolean;
}

function StatusItem({ icon, text, active }: StatusItemProps) {
  return (
    <div
      className={`flex items-center gap-2 text-sm ${
        active ? "font-medium" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span>{text}</span>
    </div>
  );
}
