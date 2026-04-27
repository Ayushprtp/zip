/**
 * Deployment API Endpoint
 *
 * Deploys a project by connecting its GitHub repo to Vercel via Git.
 * Token priority:
 *   1. User's personal vercel_token cookie (if they manually connected)
 *   2. VERCEL_TEMP_TOKEN env var (Flare-SH centralized Vercel account)
 *
 * For temporary workspace projects, the repo lives in the Flare-SH GitHub org
 * and is always deployed via the centralized token.
 *
 * For user-owned projects, we try the user's cookie first. If missing, we use
 * VERCEL_TEMP_TOKEN so users don't have to separately connect Vercel — their
 * GitHub account is enough (Vercel has the GitHub integration via Flare-SH's app).
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VERCEL_API_URL = "https://api.vercel.com";

// ── Helpers ────────────────────────────────────────────────────────────

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
 * Resolve the Vercel token.
 *
 * Priority:
 *  1. User's personal vercel_token cookie
 *  2. VERCEL_TEMP_TOKEN (Flare-SH centralized account) — used for both
 *     temp workspaces and user projects that haven't separately connected Vercel.
 *
 * Returns the token or throws with an instructional error.
 */
async function resolveToken(): Promise<string> {
  const cookieStore = await cookies();
  const userToken = cookieStore.get("vercel_token")?.value;

  if (userToken) {
    console.log("[Deploy] Using user's personal Vercel token");
    return userToken;
  }

  const tempToken = process.env.VERCEL_TEMP_TOKEN;
  if (tempToken) {
    console.log("[Deploy] Using VERCEL_TEMP_TOKEN (Flare-SH Vercel account)");
    return tempToken;
  }

  throw new Error(
    "VERCEL_NOT_CONFIGURED: No Vercel account connected. Please connect your Vercel account to deploy.",
  );
}

// ── POST Handler ───────────────────────────────────────────────────────

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
        {
          error:
            "Repository owner and name are required. Please connect a GitHub repository first.",
        },
        { status: 400 },
      );
    }

    const token = await resolveToken();

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
    const message =
      error instanceof Error ? error.message : "Deployment failed";
    const status = message.startsWith("VERCEL_NOT_CONFIGURED") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deploymentId = searchParams.get("deploymentId");

    if (!deploymentId) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 },
      );
    }

    const token = await resolveToken();

    const response = await fetch(
      `${VERCEL_API_URL}/v13/deployments/${deploymentId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      if (response.status === 404) return NextResponse.json({ success: true });
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || "Failed to delete deployment");
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete deployment error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete deployment",
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
 * 3. Explicitly trigger a deployment from the branch.
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
      projectBody.framework = framework;
    } else {
      if (opts.buildCommand) projectBody.buildCommand = opts.buildCommand;
      if (opts.outputDirectory)
        projectBody.outputDirectory = opts.outputDirectory;
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
        // Project exists on another account — re-fetch and re-use
        const refetch = await fetch(
          `${VERCEL_API_URL}/v9/projects/${sanitizedName}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (refetch.ok) {
          project = await refetch.json();
          console.log(
            `[Deploy] Re-using existing project after 409: ${project.id}`,
          );
        } else {
          throw new Error(
            `A Vercel project named "${sanitizedName}" already exists on another account. Try a different project name.`,
          );
        }
      } else if (createResp.status === 401 || createResp.status === 403) {
        throw new Error(
          "MISSING_GITHUB_APP: Vercel authentication failed or GitHub integration is missing. " +
            "Please install the Vercel GitHub App to give Vercel access to your repositories.",
        );
      } else {
        throw new Error(
          `Failed to create Vercel project: ${msg}. ` +
            `Make sure Vercel has GitHub integration and access to ${opts.repoOwner}/${opts.repoName}.`,
        );
      }
    }

    if (!project) {
      project = await createResp.json();
      console.log(`[Deploy] Created Vercel project: ${project.id}`);
    }
  }

  // ── 3. Explicitly trigger a deployment ──────────────────────────
  console.log(
    `[Deploy] Triggering deployment for "${sanitizedName}" from ${opts.repoOwner}/${opts.repoName}@${opts.branch}`,
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

    if (
      deployResp.status === 403 ||
      deployResp.status === 404 ||
      err.error?.code === "repo_not_found"
    ) {
      throw new Error(
        `MISSING_GITHUB_APP: Failed to access repository ${opts.repoOwner}/${opts.repoName}. ` +
          `Please install the Vercel GitHub App (https://github.com/apps/vercel) and grant access to this repository.`,
      );
    }

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
