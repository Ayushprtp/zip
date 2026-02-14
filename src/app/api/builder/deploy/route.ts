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
 * Token used for deploying temporary workspace projects.
 * Set this in .env so temp-workspace users can deploy without
 * connecting their own Vercel account.
 */
const VERCEL_TEMP_TOKEN = process.env.VERCEL_TEMP_TOKEN;

/**
 * Map internal template names to Vercel-recognized framework identifiers.
 * Vercel uses specific strings — sending an unrecognized framework will cause
 * a Bad Request error.
 */
function mapFramework(template: string): string | null {
  const map: Record<string, string> = {
    nextjs: "nextjs",
    "vite-react": "vite",
    react: "create-react-app",
    vue: "vue",
    svelte: "svelte",
    nuxt: "nuxtjs",
    gatsby: "gatsby",
    angular: "angular",
  };
  return map[template] ?? null;
}

/**
 * Sanitize project name for Vercel (lowercase, no spaces, only a-z0-9 and hyphens).
 */
function sanitizeProjectName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 100) || "flare-project"
  );
}

/**
 * POST /api/builder/deploy
 *
 * Deploys a project to Vercel
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { package: deploymentPackage, config, isTemporary } = body as {
      package: DeploymentPackage;
      config: DeploymentConfig;
      isTemporary?: boolean;
    };

    if (!deploymentPackage || !config) {
      return NextResponse.json(
        { error: "Missing deployment package or config" },
        { status: 400 },
      );
    }

    const result = await deployToVercel(deploymentPackage, config, isTemporary);

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
 * Deploy to Vercel.
 *
 * Token resolution order:
 *   1. User's Vercel token from cookies (personal account)
 *   2. For temporary-workspace projects: VERCEL_TEMP_TOKEN env var
 *   3. If neither is available → error
 *
 * Uses the Vercel v13 deployments API with inline file content.
 * Each file is base64-encoded and sent with an `encoding: "base64"` field
 * so Vercel correctly interprets binary/text data.
 */
async function deployToVercel(
  deploymentPackage: DeploymentPackage,
  config: DeploymentConfig,
  isTemporary?: boolean,
): Promise<{ deploymentId: string; status: string }> {
  // Get per-user Vercel token from cookies
  const cookieStore = await cookies();
  let token = cookieStore.get("vercel_token")?.value;

  // For temporary workspace projects, fall back to the server-side env token
  if (!token && isTemporary && VERCEL_TEMP_TOKEN) {
    token = VERCEL_TEMP_TOKEN;
    console.log("[Deploy] Using VERCEL_TEMP_TOKEN for temporary workspace deployment");
  }

  if (!token) {
    throw new Error(
      "Vercel token not configured. Please connect your Vercel account first.",
    );
  }

  // Prepare files for Vercel — each with explicit encoding
  const files: Array<{ file: string; data: string; encoding: "base64" }> = [];

  for (const [path, content] of Object.entries(deploymentPackage.files)) {
    // Remove leading slash — Vercel expects relative paths
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    files.push({
      file: cleanPath,
      data: Buffer.from(content, "utf-8").toString("base64"),
      encoding: "base64",
    });
  }

  // Sanitize the project name (Vercel rejects names with spaces/special chars)
  const projectName = sanitizeProjectName(config.projectName);

  // Map framework to a Vercel-recognized value (or omit if unknown)
  const framework = mapFramework(deploymentPackage.metadata.template);

  // Build project settings — only include recognized fields
  const projectSettings: Record<string, string> = {};
  if (config.buildCommand) projectSettings.buildCommand = config.buildCommand;
  if (config.outputDirectory)
    projectSettings.outputDirectory = config.outputDirectory;
  if (framework) projectSettings.framework = framework;

  // Call the Vercel deployment API
  const deployBody: Record<string, unknown> = {
    name: projectName,
    files,
    projectSettings,
  };

  console.log(
    `[Deploy] Sending ${files.length} files to Vercel as "${projectName}" (framework: ${framework || "auto"})`,
  );

  const deployResponse = await fetch(`${VERCEL_API_URL}/v13/deployments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deployBody),
  });

  if (!deployResponse.ok) {
    const error = await deployResponse.json().catch(() => ({}));
    console.error("[Deploy] Vercel API error:", error);

    // Provide more actionable error messages
    const vercelMessage =
      error.error?.message || error.message || deployResponse.statusText;

    if (deployResponse.status === 400) {
      throw new Error(
        `Vercel rejected the deployment: ${vercelMessage}. Check your token and project settings.`,
      );
    }
    if (deployResponse.status === 401 || deployResponse.status === 403) {
      throw new Error(
        "Vercel authentication failed. Please reconnect your Vercel account with a valid token.",
      );
    }

    throw new Error(`Failed to create Vercel deployment: ${vercelMessage}`);
  }

  const deployment = await deployResponse.json();

  return {
    deploymentId: deployment.id,
    status: deployment.readyState,
  };
}
