/**
 * DeploymentProgress Component
 *
 * Displays deployment progress with real-time build logs,
 * the Vercel URL, and proper error handling.
 *
 * Flow: Connect repo → Build → Deploy
 *
 * Requirements: 14.5
 */

"use client";

import React, { useRef, useEffect } from "react";
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
  Terminal,
  Globe,
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
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Merge build logs: prefer status.buildLogs (real-time) over prop buildLogs
  const activeLogs = status?.buildLogs ?? buildLogs ?? [];

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current && activeLogs.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeLogs]);

  // Use the URL from status (real-time) or from prop
  const activeUrl = status?.deploymentUrl || deploymentUrl;

  const handleCopyUrl = () => {
    if (activeUrl) {
      navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenUrl = () => {
    if (activeUrl) {
      window.open(activeUrl, "_blank", "noopener,noreferrer");
    }
  };

  const isComplete = status?.status === "success";
  const hasError = status?.status === "error" || !!error;
  const isInProgress = status && !isComplete && !hasError;
  const progress = status?.progress ?? 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5" />
            Deployment
          </DialogTitle>
          <DialogDescription>
            {isComplete && "Your project has been deployed successfully!"}
            {hasError && "Deployment encountered an error"}
            {isInProgress && "Deploying your project..."}
            {!status && !error && "Starting deployment..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress Bar */}
          {isInProgress && status && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{status.message}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Deployment URL (shown during building and after success) */}
          {activeUrl && !hasError && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/30">
              <Globe className="h-4 w-4 text-blue-400 shrink-0" />
              <code className="flex-1 text-xs text-muted-foreground break-all truncate">
                {activeUrl}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 shrink-0"
                onClick={handleCopyUrl}
              >
                {copied ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
              {isComplete && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 shrink-0"
                  onClick={handleOpenUrl}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {/* Status Steps — git-only flow: Connect → Build → Deploy */}
          {isInProgress && status && (
            <div className="space-y-2">
              {/* Step 1: Connect repository */}
              <StatusItem
                icon={
                  progress > 20 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )
                }
                text="Connecting repository to Vercel"
                active={status.status === "preparing"}
              />

              {/* Step 2: Build project (visible once repo is connected) */}
              {progress >= 30 && (
                <StatusItem
                  icon={
                    progress >= 80 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )
                  }
                  text="Building project"
                  active={
                    status.status === "building" ||
                    status.status === "deploying"
                  }
                />
              )}

              {/* Step 3: Deploy (visible once build starts finishing) */}
              {progress >= 80 && (
                <StatusItem
                  icon={
                    isComplete ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )
                  }
                  text="Deploying to production"
                  active={status.status === "deploying"}
                />
              )}
            </div>
          )}

          {/* Build Logs — shown during building AND on error */}
          {activeLogs.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-medium text-muted-foreground">
                  Build Logs
                </p>
                {isInProgress && (
                  <span className="ml-auto text-[10px] text-emerald-400 animate-pulse">
                    ● Live
                  </span>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg bg-zinc-950 border border-zinc-800 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                {activeLogs.map((line, i) => (
                  <div
                    key={i}
                    className={`whitespace-pre-wrap break-all ${
                      line.toLowerCase().includes("error")
                        ? "text-red-400 font-semibold"
                        : line.toLowerCase().includes("warn")
                          ? "text-yellow-400"
                          : line.toLowerCase().includes("ready") ||
                              line.toLowerCase().includes("success")
                            ? "text-green-400"
                            : ""
                    }`}
                  >
                    {line}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Success State */}
          {isComplete && activeUrl && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="space-y-3">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  Deployment successful!
                </p>
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
