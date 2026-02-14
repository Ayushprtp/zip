/**
 * DeploymentPanel Component
 *
 * Full deployment management panel that replaces the preview area.
 * Shows deployment history, real-time build logs, domain management,
 * and a deploy trigger button.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Rocket,
  Globe,
  ExternalLink,
  Copy,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ChevronLeft,
  Clock,
  GitCommit,
  GitBranch,
  Terminal,
  AlertTriangle,
  Link2,
} from "lucide-react";
import type { DeploymentStatus } from "@/lib/builder/deployment-service";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────

interface DeploymentRecord {
  id: string;
  url: string | null;
  state: string;
  createdAt: number;
  meta: {
    gitCommitSha?: string;
    gitCommitMessage?: string;
    gitBranch?: string;
  };
  target: string | null;
  errorMessage: string | null;
}

interface DomainRecord {
  name: string;
  verified: boolean;
  configured: boolean;
  gitBranch: string | null;
}

interface DeploymentPanelProps {
  projectName: string;
  isTemporary?: boolean;
  onClose: () => void;
  onDeploy: () => void;
  deploymentStatus: DeploymentStatus | null;
  deploymentUrl?: string;
  deploymentError?: string;
  buildLogs?: string[];
  isDeploying?: boolean;
}

// ── Main Component ─────────────────────────────────────────────────────

export function DeploymentPanel({
  projectName,
  isTemporary,
  onClose,
  onDeploy,
  deploymentStatus,
  deploymentUrl,
  deploymentError,
  buildLogs,
  isDeploying,
}: DeploymentPanelProps) {
  const [deployments, setDeployments] = useState<DeploymentRecord[]>([]);
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [productionUrl, setProductionUrl] = useState<string>("");
  const [projectExists, setProjectExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [addingDomain, setAddingDomain] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const activeLogs = deploymentStatus?.buildLogs ?? buildLogs ?? [];
  const activeUrl = deploymentStatus?.deploymentUrl || deploymentUrl;

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current && activeLogs.length > 0) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeLogs]);

  // ── Data Fetching ──────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    try {
      const resp = await fetch(
        `/api/builder/deploy/history?projectName=${encodeURIComponent(projectName)}${isTemporary ? "&isTemporary=true" : ""}`,
      );
      if (resp.ok) {
        const data = await resp.json();
        setDeployments(data.deployments || []);
        setProjectExists(data.projectExists || false);
        if (data.productionUrl) setProductionUrl(data.productionUrl);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  }, [projectName, isTemporary]);

  const fetchDomains = useCallback(async () => {
    try {
      const resp = await fetch(
        `/api/builder/deploy/domains?projectName=${encodeURIComponent(projectName)}${isTemporary ? "&isTemporary=true" : ""}`,
      );
      if (resp.ok) {
        const data = await resp.json();
        setDomains(data.domains || []);
      }
    } catch (err) {
      console.error("Failed to fetch domains:", err);
    }
  }, [projectName, isTemporary]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchHistory(), fetchDomains()]).finally(() =>
      setLoading(false),
    );
  }, [fetchHistory, fetchDomains]);

  // Refresh history when deployment status changes
  useEffect(() => {
    if (
      deploymentStatus?.status === "success" ||
      deploymentStatus?.status === "error"
    ) {
      // Slight delay for Vercel to register the new state
      const timer = setTimeout(() => fetchHistory(), 3000);
      return () => clearTimeout(timer);
    }
  }, [deploymentStatus?.status, fetchHistory]);

  // ── Domain Management ──────────────────────────────────────────────

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    setAddingDomain(true);
    try {
      const resp = await fetch("/api/builder/deploy/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName,
          domain: newDomain.trim(),
          isTemporary,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add domain");
      }
      toast.success(`Domain ${newDomain.trim()} added`);
      setNewDomain("");
      await fetchDomains();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add domain");
    } finally {
      setAddingDomain(false);
    }
  };

  const handleRemoveDomain = async (domain: string) => {
    try {
      const resp = await fetch("/api/builder/deploy/domains", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, domain, isTemporary }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Failed to remove domain");
      }
      toast.success(`Domain ${domain} removed`);
      await fetchDomains();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove domain",
      );
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────

  const hasError = deploymentStatus?.status === "error" || !!deploymentError;
  const isBuildActive =
    deploymentStatus?.status === "preparing" ||
    deploymentStatus?.status === "building" ||
    deploymentStatus?.status === "deploying";

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="h-7 w-7"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Rocket className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Deployments</span>
        <div className="flex-1" />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            fetchHistory();
            fetchDomains();
          }}
          className="h-7 w-7"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={onDeploy}
          disabled={isDeploying || isBuildActive}
          className="h-7 gap-1.5 px-3"
        >
          {isBuildActive ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Rocket className="h-3.5 w-3.5" />
          )}
          {isBuildActive ? "Deploying..." : "Deploy"}
        </Button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* ── Active Build Status ─────────────────────────────── */}
          {(isBuildActive || hasError) && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Current Deployment
              </h3>

              {/* Progress */}
              {isBuildActive && deploymentStatus && (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                    <span className="text-sm font-medium">
                      {deploymentStatus.message}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {deploymentStatus.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${deploymentStatus.progress}%` }}
                    />
                  </div>
                  {activeUrl && (
                    <div className="flex items-center gap-2 pt-1">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      <code className="text-xs text-muted-foreground truncate">
                        {activeUrl}
                      </code>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {hasError && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-medium text-red-400">
                      Deployment Failed
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {deploymentError ||
                      deploymentStatus?.message ||
                      "Unknown error"}
                  </p>
                </div>
              )}

              {/* Build Logs */}
              {activeLogs.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Build Logs
                    </span>
                    {isBuildActive && (
                      <span className="ml-auto text-[10px] text-emerald-400 animate-pulse">
                        ● Live
                      </span>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-lg bg-zinc-950 border border-zinc-800 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {activeLogs.map((line, i) => (
                      <div
                        key={i}
                        className={`whitespace-pre-wrap break-all ${
                          line.toLowerCase().includes("error")
                            ? "text-red-400 font-semibold"
                            : line.toLowerCase().includes("warn")
                              ? "text-yellow-400"
                              : line.toLowerCase().includes("ready") ||
                                  line.toLowerCase().includes("success") ||
                                  line.toLowerCase().includes("completed")
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
            </section>
          )}

          {/* ── Production URL ──────────────────────────────────── */}
          {projectExists && productionUrl && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Production
              </h3>
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-card">
                <Globe className="h-4 w-4 text-green-400 shrink-0" />
                <a
                  href={productionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-400 hover:underline truncate flex-1"
                >
                  {productionUrl}
                </a>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() => copyUrl(productionUrl)}
                >
                  {copied === productionUrl ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 shrink-0"
                  onClick={() =>
                    window.open(productionUrl, "_blank", "noopener")
                  }
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </section>
          )}

          {/* ── Custom Domains ──────────────────────────────────── */}
          {projectExists && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Custom Domains
              </h3>

              {/* Domain list */}
              {domains.length > 0 && (
                <div className="space-y-2">
                  {domains.map((d) => (
                    <div
                      key={d.name}
                      className="flex items-center gap-2 p-2.5 rounded-lg border bg-card"
                    >
                      <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate">{d.name}</span>
                      {d.verified ? (
                        <Badge
                          variant="outline"
                          className="h-5 text-[10px] text-green-500 border-green-500/30"
                        >
                          Verified
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="h-5 text-[10px] text-yellow-500 border-yellow-500/30"
                        >
                          Pending
                        </Badge>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-red-400"
                        onClick={() => handleRemoveDomain(d.name)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add domain */}
              <div className="flex gap-2">
                <Input
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDomain()}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddDomain}
                  disabled={addingDomain || !newDomain.trim()}
                  className="h-8 gap-1 px-3 shrink-0"
                >
                  {addingDomain ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add
                </Button>
              </div>
            </section>
          )}

          {/* ── Deployment History ──────────────────────────────── */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deployment History
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : deployments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Rocket className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No deployments yet</p>
                <p className="text-xs mt-1">
                  Click Deploy to create your first deployment
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {deployments.map((d) => (
                  <DeploymentRow
                    key={d.id}
                    deployment={d}
                    copied={copied}
                    onCopy={copyUrl}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── DeploymentRow ──────────────────────────────────────────────────────

function DeploymentRow({
  deployment,
  copied,
  onCopy,
}: {
  deployment: DeploymentRecord;
  copied: string | null;
  onCopy: (url: string) => void;
}) {
  const isReady = deployment.state === "READY";
  const isError = deployment.state === "ERROR";
  const isBuilding =
    deployment.state === "BUILDING" || deployment.state === "QUEUED";
  const isProduction = deployment.target === "production";

  const timeAgo = getTimeAgo(deployment.createdAt);

  return (
    <div
      className={`rounded-lg border p-3 space-y-2 ${
        isError
          ? "border-red-500/20 bg-red-500/5"
          : isProduction
            ? "border-green-500/20 bg-green-500/5"
            : "bg-card"
      }`}
    >
      {/* Top row: status + time + target */}
      <div className="flex items-center gap-2">
        {isReady && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
        {isError && <XCircle className="h-3.5 w-3.5 text-red-400" />}
        {isBuilding && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />
        )}

        <span className="text-xs font-medium">
          {isReady
            ? "Ready"
            : isError
              ? "Failed"
              : isBuilding
                ? "Building"
                : deployment.state}
        </span>

        {isProduction && (
          <Badge
            variant="outline"
            className="h-4 text-[9px] px-1 text-green-500 border-green-500/30"
          >
            Production
          </Badge>
        )}

        <div className="flex-1" />

        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </div>
      </div>

      {/* Git info */}
      {(deployment.meta.gitCommitSha || deployment.meta.gitBranch) && (
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {deployment.meta.gitBranch && (
            <span className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              {deployment.meta.gitBranch}
            </span>
          )}
          {deployment.meta.gitCommitSha && (
            <span className="flex items-center gap-1">
              <GitCommit className="h-3 w-3" />
              {deployment.meta.gitCommitSha}
            </span>
          )}
          {deployment.meta.gitCommitMessage && (
            <span className="truncate max-w-[200px]">
              {deployment.meta.gitCommitMessage}
            </span>
          )}
        </div>
      )}

      {/* URL */}
      {deployment.url && isReady && (
        <div className="flex items-center gap-1.5">
          <code className="text-[11px] text-blue-400 truncate flex-1">
            {deployment.url}
          </code>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={() => onCopy(deployment.url!)}
          >
            {copied === deployment.url ? (
              <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
            ) : (
              <Copy className="h-2.5 w-2.5" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={() => window.open(deployment.url!, "_blank", "noopener")}
          >
            <ExternalLink className="h-2.5 w-2.5" />
          </Button>
        </div>
      )}

      {/* Error */}
      {deployment.errorMessage && (
        <div className="flex items-start gap-1.5 text-[11px] text-red-400">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
          <span className="break-all">{deployment.errorMessage}</span>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
