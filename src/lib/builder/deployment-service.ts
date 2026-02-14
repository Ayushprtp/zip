/**
 * DeploymentService
 *
 * Handles deployment of projects to Vercel.
 * Serializes files to JSON and creates deployment packages with metadata.
 *
 * Requirements: 14.1
 */

import type { DeploymentConfig, DeploymentResult } from "app-types/builder";

export interface DeploymentPackage {
  files: Record<string, string>;
  metadata: {
    projectName: string;
    template: string;
    timestamp: number;
    buildCommand: string;
    outputDirectory: string;
  };
}

export interface DeploymentStatus {
  status:
    | "preparing"
    | "uploading"
    | "building"
    | "deploying"
    | "success"
    | "error";
  message: string;
  progress?: number;
}

export class DeploymentService {
  /**
   * Deploy a project to a hosting platform
   *
   * @param files - Virtual file system files
   * @param config - Deployment configuration
   * @param template - Project template type
   * @param onStatusUpdate - Callback for status updates
   * @returns Deployment result with URL and status
   */
  async deploy(
    files: Record<string, string>,
    config: DeploymentConfig,
    template: string,
    onStatusUpdate?: (status: DeploymentStatus) => void,
    isTemporary?: boolean,
  ): Promise<DeploymentResult> {
    try {
      // Step 1: Prepare deployment package
      onStatusUpdate?.({
        status: "preparing",
        message: "Preparing deployment package...",
        progress: 10,
      });

      const deploymentPackage = this.createDeploymentPackage(
        files,
        config,
        template,
      );

      // Step 2: Upload to platform
      onStatusUpdate?.({
        status: "uploading",
        message: "Uploading files to platform...",
        progress: 30,
      });

      const uploadResult = await this.uploadToplatform(
        deploymentPackage,
        config,
        isTemporary,
      );

      // Step 3: Trigger build
      onStatusUpdate?.({
        status: "building",
        message: "Building project...",
        progress: 60,
      });

      const buildResult = await this.triggerBuild(
        uploadResult.deploymentId,
        config,
      );

      // Step 4: Wait for deployment completion
      onStatusUpdate?.({
        status: "deploying",
        message: "Deploying to production...",
        progress: 80,
      });

      const finalResult = await this.waitForDeployment(
        buildResult.deploymentId,
        config,
        isTemporary,
      );

      onStatusUpdate?.({
        status: "success",
        message: "Deployment successful!",
        progress: 100,
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
   * Create a deployment package with files and metadata
   * Serializes files to JSON format for deployment
   *
   * @param files - Virtual file system files
   * @param config - Deployment configuration
   * @param template - Project template type
   * @returns Deployment package with metadata
   */
  createDeploymentPackage(
    files: Record<string, string>,
    config: DeploymentConfig,
    template: string,
  ): DeploymentPackage {
    // Serialize files to JSON
    const serializedFiles = this.serializeFiles(files);

    // Create metadata
    const metadata = {
      projectName: config.projectName,
      template,
      timestamp: Date.now(),
      buildCommand: config.buildCommand,
      outputDirectory: config.outputDirectory,
    };

    return {
      files: serializedFiles,
      metadata,
    };
  }

  /**
   * Serialize files to JSON format
   * Ensures all file paths and contents are properly formatted
   *
   * @param files - Virtual file system files
   * @returns Serialized files object
   */
  private serializeFiles(
    files: Record<string, string>,
  ): Record<string, string> {
    const serialized: Record<string, string> = {};

    for (const [path, content] of Object.entries(files)) {
      // Remove leading slash if present for consistency
      const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
      serialized[normalizedPath] = content;
    }

    return serialized;
  }

  /**
   * Upload deployment package to hosting platform
   *
   * @param deploymentPackage - Package to upload
   * @param config - Deployment configuration
   * @returns Upload result with deployment ID
   */
  private async uploadToplatform(
    deploymentPackage: DeploymentPackage,
    config: DeploymentConfig,
    isTemporary?: boolean,
  ): Promise<{ deploymentId: string }> {
    // Call the deployment API endpoint
    const response = await fetch("/api/builder/deploy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        package: deploymentPackage,
        config,
        isTemporary,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        error.error || error.message || "Failed to upload deployment package",
      );
    }

    const result = await response.json();
    return { deploymentId: result.deploymentId };
  }

  /**
   * Trigger build on hosting platform
   *
   * @param deploymentId - Deployment ID from upload
   * @param config - Deployment configuration
   * @returns Build result with deployment ID
   */
  private async triggerBuild(
    deploymentId: string,
    _config: DeploymentConfig,
  ): Promise<{ deploymentId: string }> {
    // In most platforms, build is triggered automatically after upload
    // This method is here for platforms that require explicit build triggering
    return { deploymentId };
  }

  /**
   * Wait for deployment to complete and return final result
   *
   * @param deploymentId - Deployment ID to monitor
   * @param config - Deployment configuration
   * @returns Final deployment result
   */
  private async waitForDeployment(
    deploymentId: string,
    config: DeploymentConfig,
    isTemporary?: boolean,
  ): Promise<{ url: string; logs: string[] }> {
    // Poll the deployment status endpoint
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    while (attempts < maxAttempts) {
      const statusUrl = `/api/builder/deploy/status?deploymentId=${deploymentId}&platform=${config.platform}${isTemporary ? "&isTemporary=true" : ""}`;
      const response = await fetch(statusUrl, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to check deployment status");
      }

      const result = await response.json();

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

      // Wait 5 seconds before next poll
      await new Promise((resolve) => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error("Deployment timeout - please check platform dashboard");
  }

  /**
   * Validate deployment configuration
   *
   * @param config - Configuration to validate
   * @throws Error if configuration is invalid
   */
  validateConfig(config: DeploymentConfig): void {
    if (!config.projectName || config.projectName.trim() === "") {
      throw new Error("Project name is required");
    }

    if (!config.buildCommand || config.buildCommand.trim() === "") {
      throw new Error("Build command is required");
    }

    // Note: outputDirectory is optional — for Vercel-managed frameworks
    // (nextjs, nuxtjs, gatsby, etc.) the server-side deploy route omits it.

    if (config.platform !== "vercel") {
      throw new Error("Platform must be vercel");
    }
  }
}

// Export singleton instance
export const deploymentService = new DeploymentService();
