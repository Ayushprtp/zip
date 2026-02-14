/**
 * DeploymentService
 *
 * Handles deployment of projects to Vercel by connecting the GitHub repo.
 * Every project (user-owned or temporary) has a GitHub repo, so we always
 * deploy via Git — no file uploading needed.
 *
 * Requirements: 14.1
 */

import type { DeploymentConfig, DeploymentResult } from "app-types/builder";

export interface DeploymentStatus {
  status: "preparing" | "building" | "deploying" | "success" | "error";
  message: string;
  progress?: number;
  /** Build logs streamed from Vercel */
  buildLogs?: string[];
  /** Predicted or actual deployment URL */
  deploymentUrl?: string;
}

export class DeploymentService {
  /**
   * Deploy a project by connecting its GitHub repo to Vercel.
   *
   * @param config - Deployment configuration (must include repoOwner + repoName)
   * @param template - Project template type (e.g. "react", "nextjs")
   * @param onStatusUpdate - Callback for real-time status updates (logs, URL, progress)
   * @param isTemporary - Whether this is a temporary workspace (uses VERCEL_TEMP_TOKEN)
   */
  async deploy(
    _files: Record<string, string>,
    config: DeploymentConfig,
    template: string,
    onStatusUpdate?: (status: DeploymentStatus) => void,
    isTemporary?: boolean,
  ): Promise<DeploymentResult> {
    try {
      if (!config.repoOwner || !config.repoName) {
        throw new Error(
          "Repository info is required for deployment. Please set up a GitHub project first.",
        );
      }

      // Step 1: Connect repo to Vercel
      onStatusUpdate?.({
        status: "preparing",
        message: "Connecting repository to Vercel...",
        progress: 15,
      });

      const response = await fetch("/api/builder/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoOwner: config.repoOwner,
          repoName: config.repoName,
          branch: config.repoBranch || "main",
          projectName: config.projectName,
          framework: config.template || template,
          buildCommand: config.buildCommand,
          outputDirectory: config.outputDirectory || undefined,
          isTemporary,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.error ||
            error.message ||
            "Failed to connect repository to Vercel",
        );
      }

      const result = await response.json();
      const predictedUrl = result.url || null;

      onStatusUpdate?.({
        status: "building",
        message: "Building project from repository...",
        progress: 40,
        deploymentUrl: predictedUrl,
      });

      // Step 2: Poll for completion (with real-time build logs)
      const finalResult = await this.waitForDeployment(
        result.deploymentId,
        config,
        isTemporary,
        onStatusUpdate,
      );

      onStatusUpdate?.({
        status: "success",
        message: "Deployment successful!",
        progress: 100,
        deploymentUrl: finalResult.url,
      });

      return {
        url: finalResult.url,
        status: "success",
        logs: finalResult.logs,
      };
    } catch (error) {
      onStatusUpdate?.({
        status: "error",
        message: error instanceof Error ? error.message : "Deployment failed",
        progress: 0,
      });
      throw error;
    }
  }

  /**
   * Poll deployment status until ready or error.
   * Streams build logs to the status callback during building.
   */
  private async waitForDeployment(
    deploymentId: string,
    config: DeploymentConfig,
    isTemporary?: boolean,
    onStatusUpdate?: (status: DeploymentStatus) => void,
  ): Promise<{ url: string; logs: string[] }> {
    const maxAttempts = 90; // ~7.5 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      const statusUrl = `/api/builder/deploy/status?deploymentId=${deploymentId}&platform=${config.platform}${isTemporary ? "&isTemporary=true" : ""}`;
      const response = await fetch(statusUrl, { method: "GET" });

      if (!response.ok) {
        throw new Error("Failed to check deployment status");
      }

      const result = await response.json();

      // Stream build logs to UI during building
      if (
        result.logs &&
        result.logs.length > 0 &&
        onStatusUpdate &&
        result.status === "building"
      ) {
        onStatusUpdate({
          status: "building",
          message: "Building project...",
          progress: 40 + Math.min(attempts * 2, 39), // 40→79
          buildLogs: result.logs,
          deploymentUrl: result.url,
        });
      }

      if (result.status === "ready") {
        return {
          url: result.url,
          logs: result.logs || [],
        };
      }

      if (result.status === "error") {
        const err = new Error(result.error || "Deployment failed") as any;
        err.buildLogs = result.logs || [];
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error("Deployment timeout - please check platform dashboard");
  }

  /**
   * Validate deployment configuration.
   */
  validateConfig(config: DeploymentConfig): void {
    if (!config.projectName || config.projectName.trim() === "") {
      throw new Error("Project name is required");
    }

    if (!config.repoOwner || !config.repoName) {
      throw new Error(
        "Repository info is required. Set up a GitHub project first.",
      );
    }

    if (config.platform !== "vercel") {
      throw new Error("Platform must be vercel");
    }
  }
}

// Export singleton instance
export const deploymentService = new DeploymentService();
