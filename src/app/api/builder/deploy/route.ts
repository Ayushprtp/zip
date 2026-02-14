/**
 * Deployment API Endpoint
 *
 * Deploys a project by connecting its GitHub repo to Vercel.
 * Since every project (user-owned or temporary) has a GitHub repo,
 * we always deploy via Git — no file uploading needed.
 *
 * Requirements: 14.2, 14.3, 14.4
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Vercel API configuration
const VERCEL_API_URL = "https://api.vercel.com";

/**
 * Token used for deploying temporary workspace projects.
 * Set this in .env so temp-workspace users can deploy without
 * connecting their own Vercel account.
 */
const VERCEL_TEMP_TOKEN = process.env.VERCEL_TEMP_TOKEN;

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Map internal template names to Vercel-recognized framework identifiers.
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
 * Sanitize project name for Vercel (lowercase, a-z0-9 and hyphens only).
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
 * Resolve the Vercel token from cookies or env.
 */
async function resolveToken(isTemporary?: boolean): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get("vercel_token")?.value;

  if (!token && isTemporary && VERCEL_TEMP_TOKEN) {
    token = VERCEL_TEMP_TOKEN;
    console.log(
      "[Deploy] Using VERCEL_TEMP_TOKEN for temporary workspace deployment",
    );
  }

  if (!token) {
    throw new Error(
      "Vercel token not configured. Please connect your Vercel account first.",
    );
  }
  return token;
}

// ── POST Handler ───────────────────────────────────────────────────────

/**
 * POST /api/builder/deploy
 *
 * Body: {
 *   repoOwner: string,   — GitHub repo owner
 *   repoName: string,    — GitHub repo name
 *   branch?: string,     — Git branch (default: "main")
 *   projectName: string, — Display name / Vercel project name
 *   framework?: string,  — Internal template name (e.g. "react", "nextjs")
 *   buildCommand?: string,
 *   outputDirectory?: string,
 *   isTemporary?: boolean — true for temp-workspace projects
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      repoOwner,
      repoName,
      branch,
      projectName,
      framework,
      buildCommand,
      outputDirectory,
      isTemporary,
    } = body as {
      repoOwner: string;
      repoName: string;
      branch?: string;
      projectName: string;
      framework?: string;
      buildCommand?: string;
      outputDirectory?: string;
      isTemporary?: boolean;
    };

    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: "Repository owner and name are required" },
        { status: 400 },
      );
    }

    const token = await resolveToken(isTemporary);

    const result = await deployViaGit(token, {
      repoOwner,
      repoName,
      branch: branch || "main",
      projectName: projectName || repoName,
      framework,
      buildCommand,
      outputDirectory,
    });

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

// ── Git-based deployment ───────────────────────────────────────────────

interface GitDeployOpts {
  repoOwner: string;
  repoName: string;
  branch: string;
  projectName: string;
  framework?: string;
  buildCommand?: string;
  outputDirectory?: string;
}

/**
 * Deploy by connecting the GitHub repo to a Vercel project.
 *
 * 1. Check if a Vercel project with this name already exists.
 * 2. If not, create one linked to the GitHub repo → Vercel auto-deploys.
 * 3. Find the latest deployment for the project.
 * 4. Return the deployment ID + predicted production URL.
 */
async function deployViaGit(
  token: string,
  opts: GitDeployOpts,
): Promise<{
  deploymentId: string;
  status: string;
  url: string | null;
  projectUrl: string;
}> {
  const sanitizedName = sanitizeProjectName(opts.projectName);
  const framework = mapFramework(opts.framework || "");

  // ── 1. Check if Vercel project already exists ──────────────────
  let project: any = null;

  const checkResp = await fetch(
    `${VERCEL_API_URL}/v9/projects/${sanitizedName}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (checkResp.ok) {
    project = await checkResp.json();
    console.log(
      `[Deploy] Found existing Vercel project: ${project.id} (${project.name})`,
    );
  }

  // ── 2. Create project if it doesn't exist ──────────────────────
  if (!project) {
    const projectBody: Record<string, unknown> = {
      name: sanitizedName,
      gitRepository: {
        type: "github",
        repo: `${opts.repoOwner}/${opts.repoName}`,
      },
    };

    if (framework) {
      // When Vercel recognizes the framework, it auto-detects the correct
      // build command and output directory. Don't override them — doing so
      // with e.g. "npm run build" can break frameworks that use custom
      // build pipelines (Next.js, Nuxt, Gatsby, etc.).
      projectBody.framework = framework;
    } else {
      // Unknown framework — pass explicit build settings
      if (opts.buildCommand) projectBody.buildCommand = opts.buildCommand;
      if (opts.outputDirectory) {
        projectBody.outputDirectory = opts.outputDirectory;
      }
    }

    console.log(
      `[Deploy] Creating Vercel project "${sanitizedName}" connected to ${opts.repoOwner}/${opts.repoName}`,
    );

    const createResp = await fetch(`${VERCEL_API_URL}/v10/projects`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(projectBody),
    });

    if (!createResp.ok) {
      const err = await createResp.json().catch(() => ({}));
      const msg = err.error?.message || createResp.statusText;

      if (createResp.status === 409) {
        console.warn(`[Deploy] Project name "${sanitizedName}" is taken.`);
        throw new Error(
          `A Vercel project named "${sanitizedName}" already exists on another account. Try a different project name.`,
        );
      }
      if (createResp.status === 401 || createResp.status === 403) {
        throw new Error(
          "Vercel authentication failed. Please reconnect your Vercel account.",
        );
      }

      throw new Error(
        `Failed to create Vercel project: ${msg}. ` +
          `Make sure your Vercel account has GitHub integration and access to ${opts.repoOwner}/${opts.repoName}.`,
      );
    }

    project = await createResp.json();
    console.log(`[Deploy] Created Vercel project: ${project.id}`);
  }

  // ── 3. Explicitly trigger a deployment ──────────────────────────
  // Don't rely on auto-deployment (webhook-based) — it can take 30+ seconds.
  // Instead, explicitly create a deployment from the repo's branch.
  console.log(
    `[Deploy] Triggering deployment for project "${sanitizedName}" from ${opts.repoOwner}/${opts.repoName}@${opts.branch}`,
  );

  const deployBody: Record<string, unknown> = {
    name: sanitizedName,
    gitSource: {
      type: "github",
      org: opts.repoOwner,
      repo: opts.repoName,
      ref: opts.branch,
    },
  };

  const deployResp = await fetch(`${VERCEL_API_URL}/v13/deployments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deployBody),
  });

  if (!deployResp.ok) {
    const err = await deployResp.json().catch(() => ({}));
    const msg = err.error?.message || deployResp.statusText;
    console.error("[Deploy] Failed to create deployment:", err);
    throw new Error(
      `Failed to trigger deployment: ${msg}. ` +
        `Make sure the Vercel GitHub integration has access to ${opts.repoOwner}/${opts.repoName}.`,
    );
  }

  const deployment = await deployResp.json();
  const deploymentId = deployment.id || deployment.uid;
  const predictedUrl = `https://${sanitizedName}.vercel.app`;

  console.log(`[Deploy] Deployment created: ${deploymentId} → ${predictedUrl}`);

  return {
    deploymentId,
    status: "building",
    url: predictedUrl,
    projectUrl: `https://vercel.com/${project.name}`,
  };
}
