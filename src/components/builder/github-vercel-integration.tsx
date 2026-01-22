/**
 * GitHub & Vercel Integration Component
 * Main component that orchestrates the full integration workflow
 */

"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GitHubConnectionPanel } from "./github-connection-panel";
import { VercelConnectionPanel } from "./vercel-connection-panel";
import { GitHistorySidebar } from "./git-history-sidebar";
import { DeploymentDashboard } from "./deployment-dashboard";
import { Button } from "@/components/ui/button";
import { useGitHubIntegration } from "@/lib/builder/use-github-integration";
import { useVercelIntegration } from "@/lib/builder/use-vercel-integration";
import { useProject } from "@/lib/builder/project-context";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

export function GitHubVercelIntegration() {
  const { state } = useProject();
  const github = useGitHubIntegration();
  const vercel = useVercelIntegration();
  const [syncing, setSyncing] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("");

  const handleInitializeAndSync = async () => {
    if (!github.isConnected || !github.repos.length) {
      toast.error("Please connect GitHub and ensure you have repositories");
      return;
    }

    setSyncing(true);
    try {
      // Get token from cookie (in real app, handle this securely)
      const token = ""; // This should come from your auth system

      // Use the first available repo
      const repo = github.repos[0];

      await github.initializeRepo(state.files, repo.clone_url, token);

      toast.success("Project synced to GitHub!");

      // If Vercel is connected, create project
      if (vercel.isConnected) {
        const project = await vercel.createProject(
          repo.name,
          { type: "github", repo: repo.full_name },
          {
            framework: state.template === "nextjs" ? "nextjs" : "vite",
            buildCommand: "npm run build",
            outputDirectory: state.template === "nextjs" ? ".next" : "dist",
          },
        );

        setSelectedProject(project.id);
        toast.success("Vercel project created and linked!");
      }
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Pro Features</h2>
          <Button
            onClick={handleInitializeAndSync}
            disabled={syncing || !github.isConnected || !github.repos.length}
          >
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Initialize & Sync
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="github" className="flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="github" className="flex-1">
            GitHub
          </TabsTrigger>
          <TabsTrigger value="vercel" className="flex-1">
            Vercel
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1">
            History
          </TabsTrigger>
          <TabsTrigger value="deployments" className="flex-1">
            Deployments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="github" className="flex-1 p-4">
          <GitHubConnectionPanel />
        </TabsContent>

        <TabsContent value="vercel" className="flex-1 p-4">
          <VercelConnectionPanel />
        </TabsContent>

        <TabsContent value="history" className="flex-1">
          <GitHistorySidebar
            onLoadHistory={github.getCommitHistory}
            onCheckout={async (hash) => {
              await github.git.checkout(hash);
              await github.vfs.exportToProjectFiles();
              // Update project context with checked out files
              toast.success("Checked out commit");
            }}
            onReset={async (hash) => {
              await github.git.resetHard(hash);
              toast.success("Reset to commit");
            }}
          />
        </TabsContent>

        <TabsContent value="deployments" className="flex-1 p-4">
          {selectedProject ? (
            <DeploymentDashboard
              projectId={selectedProject}
              onLoadDeployments={vercel.loadDeployments}
              onTriggerDeployment={vercel.triggerDeployment}
            />
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Connect Vercel and create a project to see deployments
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
