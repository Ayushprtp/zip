/**
 * Promote Deployment API
 *
 * Promotes a preview deployment to production by creating a new
 * production-targeted deployment from the same git ref.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VERCEL_API_URL = "https://api.vercel.com";

async function resolveToken(): Promise<string> {
  const cookieStore = await cookies();
  const userToken = cookieStore.get("vercel_token")?.value;
  if (userToken) return userToken;

  const tempToken = process.env.VERCEL_TEMP_TOKEN;
  if (tempToken) return tempToken;

  throw new Error("VERCEL_NOT_CONFIGURED: No Vercel account connected.");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deploymentId, projectName } = body as {
      deploymentId: string;
      projectName: string;
    };

    if (!deploymentId) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 },
      );
    }

    const token = await resolveToken();

    // 1. Get the existing deployment details
    const deployResp = await fetch(
      `${VERCEL_API_URL}/v13/deployments/${deploymentId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!deployResp.ok) {
      const err = await deployResp.json().catch(() => ({}));
      throw new Error(
        err.error?.message || "Failed to fetch deployment details",
      );
    }

    const deployment = await deployResp.json();

    // 2. Check if already production
    if (deployment.target === "production") {
      return NextResponse.json({
        message: "Deployment is already in production",
        deploymentId,
      });
    }

    // 3. Re-deploy with target=production using the same git source
    const gitMeta = deployment.meta || {};
    const repoOwner = gitMeta.githubOrg || gitMeta.gitlabProjectNamespace;
    const repoName = gitMeta.githubRepo || gitMeta.gitlabProjectRepo;
    const ref =
      gitMeta.githubCommitSha ||
      gitMeta.gitCommitSha ||
      gitMeta.githubCommitRef ||
      gitMeta.gitBranch ||
      "main";

    if (!repoOwner || !repoName) {
      // Fallback: use Vercel's alias promotion API
      console.log(
        "[Promote] No git source found, using alias-based promotion",
      );

      const aliasResp = await fetch(
        `${VERCEL_API_URL}/v2/deployments/${deploymentId}/aliases`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            alias: `${projectName}.vercel.app`,
          }),
        },
      );

      if (!aliasResp.ok) {
        const err = await aliasResp.json().catch(() => ({}));
        throw new Error(
          err.error?.message || "Failed to promote via alias",
        );
      }

      return NextResponse.json({
        message: "Deployment promoted to production",
        deploymentId,
        url: `https://${projectName}.vercel.app`,
      });
    }

    // Re-deploy with production target from the same commit
    console.log(
      `[Promote] Re-deploying ${repoOwner}/${repoName}@${ref} as production`,
    );

    const promoteResp = await fetch(`${VERCEL_API_URL}/v13/deployments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: deployment.name,
        target: "production",
        gitSource: {
          type: "github",
          org: repoOwner,
          repo: repoName,
          ref,
        },
      }),
    });

    if (!promoteResp.ok) {
      const err = await promoteResp.json().catch(() => ({}));
      throw new Error(
        err.error?.message || "Failed to create production deployment",
      );
    }

    const promoted = await promoteResp.json();
    const newId = promoted.id || promoted.uid;

    console.log(`[Promote] Production deployment created: ${newId}`);

    return NextResponse.json({
      message: "Deployment promoted to production",
      deploymentId: newId,
      url: promoted.url
        ? `https://${promoted.url}`
        : `https://${deployment.name}.vercel.app`,
    });
  } catch (error) {
    console.error("Promote error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to promote deployment",
      },
      { status: 500 },
    );
  }
}
