/**
 * Deployment Dashboard Component
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Rocket,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { VercelDeployment } from "@/lib/builder/use-vercel-integration";

interface DeploymentDashboardProps {
  projectId: string;
  onLoadDeployments: (projectId: string) => Promise<VercelDeployment[]>;
  onTriggerDeployment: (projectId: string) => Promise<VercelDeployment>;
}

export function DeploymentDashboard({
  projectId,
  onLoadDeployments,
  onTriggerDeployment,
}: DeploymentDashboardProps) {
  const [deployments, setDeployments] = useState<VercelDeployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadDeployments();
    }
  }, [projectId]);

  const loadDeployments = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const data = await onLoadDeployments(projectId);
      setDeployments(data);
    } catch (err) {
      console.error("Failed to load deployments:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      await onTriggerDeployment(projectId);
      await loadDeployments();
    } catch (err) {
      console.error("Deployment failed:", err);
    } finally {
      setDeploying(false);
    }
  };

  const getStatusIcon = (state: string) => {
    switch (state) {
      case "READY":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "ERROR":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "BUILDING":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (state: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      READY: "default",
      BUILDING: "secondary",
      ERROR: "destructive",
    };

    return <Badge variant={variants[state] || "secondary"}>{state}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Deployments
            </CardTitle>
            <CardDescription>Manage your Vercel deployments</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDeployments}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleDeploy}
              disabled={deploying || !projectId}
            >
              {deploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Deploy Now
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="space-y-3">
            {deployments.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No deployments yet
              </p>
            ) : (
              deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(deployment.state)}
                        <a
                          href={`https://${deployment.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium hover:underline"
                        >
                          {deployment.url}
                        </a>
                        <ExternalLink className="h-3 w-3" />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(deployment.created, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      {deployment.meta?.githubCommitMessage && (
                        <p className="text-sm text-muted-foreground">
                          {deployment.meta.githubCommitMessage}
                        </p>
                      )}
                    </div>
                    {getStatusBadge(deployment.state)}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
