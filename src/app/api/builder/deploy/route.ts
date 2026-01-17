/**
 * Deployment API Endpoint
 *
 * Handles deployment requests to Netlify/Vercel.
 * Receives project files and configuration, triggers deployment, and returns status.
 *
 * Requirements: 14.2, 14.3, 14.4
 */

import { NextRequest, NextResponse } from "next/server";
import type { DeploymentConfig } from "app-types/builder";
import type { DeploymentPackage } from "@/lib/builder/deployment-service";

// Netlify API configuration
const NETLIFY_API_URL = "https://api.netlify.com/api/v1";
const NETLIFY_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;

// Vercel API configuration
const VERCEL_API_URL = "https://api.vercel.com";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

interface DeploymentRequest {
  package: DeploymentPackage;
  config: DeploymentConfig;
}

/**
 * POST /api/builder/deploy
 *
 * Initiates a deployment to the specified platform
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: DeploymentRequest = await request.json();
    const { package: deploymentPackage, config } = body;

    // Validate request
    if (!deploymentPackage || !config) {
      return NextResponse.json(
        { error: "Missing deployment package or configuration" },
        { status: 400 },
      );
    }

    // Validate configuration
    const validationError = validateDeploymentConfig(config);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Deploy to the specified platform
    let result;
    if (config.platform === "netlify") {
      result = await deployToNetlify(deploymentPackage, config);
    } else if (config.platform === "vercel") {
      result = await deployToVercel(deploymentPackage, config);
    } else {
      return NextResponse.json(
        { error: "Unsupported platform" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      deploymentId: result.deploymentId,
      status: result.status,
      message: "Deployment initiated successfully",
    });
  } catch (error) {
    console.error("Deployment error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Deployment failed",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}

/**
 * Validate deployment configuration
 */
function validateDeploymentConfig(config: DeploymentConfig): string | null {
  if (!config.projectName || config.projectName.trim() === "") {
    return "Project name is required";
  }

  if (!config.buildCommand || config.buildCommand.trim() === "") {
    return "Build command is required";
  }

  if (!config.outputDirectory || config.outputDirectory.trim() === "") {
    return "Output directory is required";
  }

  if (!["netlify", "vercel"].includes(config.platform)) {
    return "Platform must be either netlify or vercel";
  }

  return null;
}

/**
 * Deploy to Netlify
 */
async function deployToNetlify(
  deploymentPackage: DeploymentPackage,
  config: DeploymentConfig,
): Promise<{ deploymentId: string; status: string }> {
  if (!NETLIFY_TOKEN) {
    throw new Error("Netlify access token not configured");
  }

  // Step 1: Create or get site
  const site = await getOrCreateNetlifySite(config.projectName);

  // Step 2: Create deployment
  const deployment = await createNetlifyDeployment(
    site.id,
    deploymentPackage,
    config,
  );

  return {
    deploymentId: deployment.id,
    status: deployment.state,
  };
}

/**
 * Get or create Netlify site
 */
async function getOrCreateNetlifySite(projectName: string): Promise<any> {
  // Check if site exists
  const sitesResponse = await fetch(`${NETLIFY_API_URL}/sites`, {
    headers: {
      Authorization: `Bearer ${NETLIFY_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!sitesResponse.ok) {
    throw new Error("Failed to fetch Netlify sites");
  }

  const sites = await sitesResponse.json();
  const existingSite = sites.find((site: any) => site.name === projectName);

  if (existingSite) {
    return existingSite;
  }

  // Create new site
  const createResponse = await fetch(`${NETLIFY_API_URL}/sites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NETLIFY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: projectName,
      custom_domain: null,
    }),
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(`Failed to create Netlify site: ${error.message}`);
  }

  return await createResponse.json();
}

/**
 * Create Netlify deployment
 */
async function createNetlifyDeployment(
  siteId: string,
  deploymentPackage: DeploymentPackage,
  _config: DeploymentConfig,
): Promise<any> {
  // Prepare files for Netlify
  const files: Record<string, string> = {};

  for (const [path, content] of Object.entries(deploymentPackage.files)) {
    files[path] = content;
  }

  // Create deployment
  const deployResponse = await fetch(
    `${NETLIFY_API_URL}/sites/${siteId}/deploys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files,
        draft: false,
        branch: "main",
        framework: deploymentPackage.metadata.template,
      }),
    },
  );

  if (!deployResponse.ok) {
    const error = await deployResponse.json();
    throw new Error(`Failed to create Netlify deployment: ${error.message}`);
  }

  return await deployResponse.json();
}

/**
 * Deploy to Vercel
 */
async function deployToVercel(
  deploymentPackage: DeploymentPackage,
  config: DeploymentConfig,
): Promise<{ deploymentId: string; status: string }> {
  if (!VERCEL_TOKEN) {
    throw new Error("Vercel token not configured");
  }

  // Prepare files for Vercel
  const files: Array<{ file: string; data: string }> = [];

  for (const [path, content] of Object.entries(deploymentPackage.files)) {
    files.push({
      file: path,
      data: Buffer.from(content).toString("base64"),
    });
  }

  // Create deployment
  const deployResponse = await fetch(`${VERCEL_API_URL}/v13/deployments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${VERCEL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: config.projectName,
      files,
      projectSettings: {
        buildCommand: config.buildCommand,
        outputDirectory: config.outputDirectory,
        framework: deploymentPackage.metadata.template,
      },
    }),
  });

  if (!deployResponse.ok) {
    const error = await deployResponse.json();
    throw new Error(`Failed to create Vercel deployment: ${error.message}`);
  }

  const deployment = await deployResponse.json();

  return {
    deploymentId: deployment.id,
    status: deployment.readyState,
  };
}
