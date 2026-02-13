/**
 * Deploy Pipeline Panel — "Ship It" Button UI
 *
 * Orchestrates the full deployment pipeline:
 *   1. Save to GitHub (with .env file generation)
 *   2. Link and configure Vercel
 *   3. Inject environment variables
 *   4. Trigger deploy + show live status
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Rocket,
  Github,
  Triangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Upload,
  Key,
  Zap,
} from "lucide-react";
import { useProject } from "@/lib/builder/project-context";
import type { UseSecretsManagerReturn } from "@/lib/builder/cloud-integration/use-secrets-manager";
import {
  cloudService,
  type DeploymentStatus,
} from "@/lib/builder/cloud-integration/cloud-service";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeployPipelinePanelProps {
  secretsManager: UseSecretsManagerReturn;
}

interface PipelineStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "pending" | "active" | "done" | "error";
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DeployPipelinePanel({
  secretsManager,
}: DeployPipelinePanelProps) {
  const { state } = useProject();

  // Form state
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [vercelToken, setVercelToken] = useState("");

  // Pipeline state
  const [deploying, setDeploying] = useState(false);
  const [deployStatus, setDeployStatus] = useState<DeploymentStatus | null>(
    null,
  );
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Load tokens from secrets if available
  useEffect(() => {
    const loadTokens = async () => {
      const ghToken = secretsManager.getProviderSecrets("github");
      const vToken = secretsManager.getProviderSecrets("vercel");
      if (ghToken.length > 0 && ghToken[0].value) {
        setGithubToken(ghToken[0].value);
      }
      if (vToken.length > 0 && vToken[0].value) {
        setVercelToken(vToken[0].value);
      }
    };
    loadTokens();
  }, [secretsManager]);

  const updateStep = useCallback(
    (stepId: string, status: PipelineStep["status"]) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === stepId ? { ...s, status } : s)),
      );
    },
    [],
  );

  // ──── Push to GitHub Only ────────────────────────────────────────────────

  const handlePushToGitHub = useCallback(async () => {
    if (!githubOwner || !githubRepo || !githubToken) {
      toast.error("Please fill in GitHub owner, repository, and token");
      return;
    }

    setDeploying(true);
    setSteps([
      {
        id: "push",
        label: "Push to GitHub",
        icon: <Github className="h-4 w-4" />,
        status: "active",
      },
    ]);

    try {
      cloudService.setGitHubToken(githubToken);
      const envVars = await secretsManager.buildEnvVarsJson();

      // Remove token keys from env vars pushed
      const filteredEnvVars = Object.fromEntries(
        Object.entries(envVars).filter(
          ([key]) =>
            !key.includes("TOKEN") &&
            !key.includes("GITHUB") &&
            !key.includes("VERCEL"),
        ),
      );

      await cloudService.pushToGitHub(
        githubOwner,
        githubRepo,
        state.files,
        filteredEnvVars,
        "Update from Flare IDE",
      );

      updateStep("push", "done");
      toast.success("Code pushed to GitHub successfully!");
    } catch (err: any) {
      updateStep("push", "error");
      toast.error(`Push failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  }, [
    githubOwner,
    githubRepo,
    githubToken,
    state.files,
    secretsManager,
    updateStep,
  ]);

  // ──── Full "Ship It" Pipeline ──────────────────────────────────────────

  const handleShipIt = useCallback(async () => {
    if (!githubOwner || !githubRepo || !githubToken) {
      toast.error("Please fill in GitHub owner, repository, and token");
      return;
    }
    if (!vercelToken) {
      toast.error("Please provide your Vercel token");
      return;
    }

    setDeploying(true);
    setLiveUrl(null);
    setDeployStatus(null);

    const pipelineSteps: PipelineStep[] = [
      {
        id: "push",
        label: "Push to GitHub",
        icon: <Github className="h-4 w-4" />,
        status: "pending",
      },
      {
        id: "link",
        label: "Link Vercel project",
        icon: <Triangle className="h-4 w-4" />,
        status: "pending",
      },
      {
        id: "env",
        label: "Inject env variables",
        icon: <Key className="h-4 w-4" />,
        status: "pending",
      },
      {
        id: "deploy",
        label: "Deploy",
        icon: <Rocket className="h-4 w-4" />,
        status: "pending",
      },
    ];
    setSteps(pipelineSteps);

    try {
      cloudService.setGitHubToken(githubToken);
      cloudService.setVercelToken(vercelToken);

      const envVars = await secretsManager.buildEnvVarsJson();

      // Filter out sensitive tokens
      const deployEnvVars = Object.fromEntries(
        Object.entries(envVars).filter(
          ([key]) =>
            !key.includes("GITHUB_TOKEN") && !key.includes("VERCEL_TOKEN"),
        ),
      );

      const result = await cloudService.shipIt(
        githubOwner,
        githubRepo,
        state.files,
        deployEnvVars,
        state.template,
        (status) => {
          setDeployStatus(status);

          // Update steps based on state
          switch (status.state) {
            case "linking":
              updateStep("push", "done");
              updateStep("link", "active");
              break;
            case "injecting_env":
              updateStep("link", "done");
              updateStep("env", "active");
              break;
            case "triggering":
              updateStep("env", "done");
              updateStep("deploy", "active");
              break;
            case "building":
              updateStep("deploy", "active");
              break;
            case "ready":
              updateStep("deploy", "done");
              if (status.url) setLiveUrl(`https://${status.url}`);
              break;
            case "error":
              // Mark current step as error
              setSteps((prev) =>
                prev.map((s) =>
                  s.status === "active" ? { ...s, status: "error" } : s,
                ),
              );
              break;
          }

          // Scroll status into view
          statusRef.current?.scrollIntoView({ behavior: "smooth" });
        },
      );

      if (result.state === "ready") {
        toast.success("🎉 Deployment is live!");
      } else if (result.state === "error") {
        toast.error(result.error || result.message);
      }
    } catch (err: any) {
      toast.error(`Pipeline failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  }, [
    githubOwner,
    githubRepo,
    githubToken,
    vercelToken,
    state.files,
    state.template,
    secretsManager,
    updateStep,
  ]);

  const isGitHubReady = githubOwner && githubRepo && githubToken;
  const isFullPipelineReady = isGitHubReady && vercelToken;

  return (
    <div className="space-y-4">
      {/* GitHub Configuration */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub Repository
          </CardTitle>
          <CardDescription className="text-[11px]">
            Where to push your code
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Owner</Label>
              <Input
                placeholder="username"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                className="h-8 text-xs"
                disabled={deploying}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">
                Repository
              </Label>
              <Input
                placeholder="my-project"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                className="h-8 text-xs"
                disabled={deploying}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Access Token
            </Label>
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxx"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              className="h-8 text-xs font-mono"
              disabled={deploying}
            />
          </div>
        </CardContent>
      </Card>

      {/* Vercel Configuration */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm flex items-center gap-2">
            <Triangle className="h-4 w-4" />
            Vercel Deployment
          </CardTitle>
          <CardDescription className="text-[11px]">
            Deploy token for automated deployments
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-3 space-y-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">
              Vercel Token
            </Label>
            <Input
              type="password"
              placeholder="VrCl_xxxxxxxxxxxxx"
              value={vercelToken}
              onChange={(e) => setVercelToken(e.target.value)}
              className="h-8 text-xs font-mono"
              disabled={deploying}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePushToGitHub}
          disabled={deploying || !isGitHubReady}
          className="flex-1 text-xs"
        >
          {deploying && steps.length === 1 ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Upload className="mr-1.5 h-3 w-3" />
          )}
          Save to GitHub
        </Button>
        <Button
          size="sm"
          onClick={handleShipIt}
          disabled={deploying || !isFullPipelineReady}
          className="flex-1 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white border-0"
        >
          {deploying && steps.length > 1 ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Rocket className="mr-1.5 h-3 w-3" />
          )}
          Ship It!
        </Button>
      </div>

      {/* Pipeline Status */}
      {steps.length > 0 && (
        <Card className="border-border/50 overflow-hidden" ref={statusRef}>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Pipeline Status
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-3 py-1.5">
                  {/* Step Icon */}
                  <div
                    className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-300 ${
                      step.status === "done"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                        : step.status === "active"
                          ? "border-blue-500 bg-blue-500/20 text-blue-400 animate-pulse"
                          : step.status === "error"
                            ? "border-red-500 bg-red-500/20 text-red-400"
                            : "border-muted-foreground/30 text-muted-foreground/50"
                    }`}
                  >
                    {step.status === "done" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : step.status === "active" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : step.status === "error" ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <span className="text-[10px] font-bold">{index + 1}</span>
                    )}
                  </div>

                  {/* Step Label */}
                  <div className="flex-1">
                    <p
                      className={`text-xs font-medium ${
                        step.status === "done"
                          ? "text-emerald-400"
                          : step.status === "active"
                            ? "text-blue-400"
                            : step.status === "error"
                              ? "text-red-400"
                              : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <Badge
                    variant="secondary"
                    className={`text-[9px] px-1.5 py-0.5 ${
                      step.status === "done"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : step.status === "active"
                          ? "bg-blue-500/10 text-blue-400"
                          : step.status === "error"
                            ? "bg-red-500/10 text-red-400"
                            : "bg-muted"
                    }`}
                  >
                    {step.status === "done"
                      ? "Done"
                      : step.status === "active"
                        ? "Running"
                        : step.status === "error"
                          ? "Failed"
                          : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Current status message */}
            {deployStatus && (
              <div
                className={`mt-3 p-2 rounded-md text-xs ${
                  deployStatus.state === "error"
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : deployStatus.state === "ready"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                }`}
              >
                {deployStatus.message}
              </div>
            )}

            {/* Live URL */}
            {liveUrl && (
              <div className="mt-3 p-2.5 rounded-lg bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20">
                <p className="text-[10px] text-muted-foreground mb-1">
                  🎉 Your site is live!
                </p>
                <a
                  href={liveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  {liveUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help text */}
      <p className="text-[10px] text-muted-foreground/50 text-center leading-relaxed">
        <strong>Save to GitHub</strong> pushes code + auto-generates .env.local
        <br />
        <strong>Ship It</strong> pushes, creates Vercel project, injects env
        vars, and deploys
      </p>
    </div>
  );
}
