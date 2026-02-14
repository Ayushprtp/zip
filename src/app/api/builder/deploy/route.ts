/**
 * Deployment API Endpoint
 *
 * Handles deployment requests to Vercel.
 * Receives project files and configuration, triggers deployment, and returns status.
 *
 * Requirements: 14.2, 14.3, 14.4
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Vercel API configuration
const VERCEL_API_URL = "https://api.vercel.com";

interface DeploymentPackage {
  files: Record<string, string>;
  metadata: {
    projectName: string;
    template: string;
    timestamp: number;
    buildCommand: string;
    outputDirectory: string;
  };
}

interface DeploymentConfig {
  platform: string;
  projectName: string;
  buildCommand: string;
  outputDirectory: string;
}

/**
 * POST /api/builder/deploy
 *
 * Deploys a project to Vercel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { package: deploymentPackage, config } = body as {
      package: DeploymentPackage;
      config: DeploymentConfig;
    };

    if (!deploymentPackage || !config) {
      return NextResponse.json(
        { error: "Missing deployment package or config" },
        { status: 400 },
      );
    }

    const result = await deployToVercel(deploymentPackage, config);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Deployment error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Deployment failed",
      },
      { status: 500 },
    );
  }
}

/**
 * Deploy to Vercel using the user's token from cookies
 */
async function deployToVercel(
  deploymentPackage: DeploymentPackage,
  config: DeploymentConfig,
): Promise<{ deploymentId: string; status: string }> {
  // Get per-user Vercel token from cookies
  const cookieStore = await cookies();
  const token = cookieStore.get("vercel_token")?.value;

  if (!token) {
    throw new Error(
      "Vercel token not configured. Please connect your Vercel account first.",
    );
  }

  // Prepare files for Vercel
  const files: Array<{ file: string; data: string }> = [];

  for (const [path, content] of Object.entries(deploymentPackage.files)) {
    files.push({
      file: path,
      data: Buffer.from(content).toString("base64"),
    });
  }

  // Call the Vercel deployment API
  const deployResponse = await fetch(`${VERCEL_API_URL}/v13/deployments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
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
    const error = await deployResponse.json().catch(() => ({}));
    throw new Error(
      `Failed to create Vercel deployment: ${error.message || deployResponse.statusText}`,
    );
  }

  const deployment = await deployResponse.json();

  return {
    deploymentId: deployment.id,
    status: deployment.readyState,
  };
}
