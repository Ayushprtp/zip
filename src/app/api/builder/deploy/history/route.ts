/**
 * Deployment History API
 *
 * GET /api/builder/deploy/history?projectName=xxx
 *
 * Fetches all deployments for a Vercel project.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VERCEL_API_URL = "https://api.vercel.com";
const VERCEL_TEMP_TOKEN = process.env.VERCEL_TEMP_TOKEN;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectName = searchParams.get("projectName");
    const isTemporary = searchParams.get("isTemporary") === "true";

    if (!projectName) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    let token = cookieStore.get("vercel_token")?.value;
    if (!token && isTemporary && VERCEL_TEMP_TOKEN) {
      token = VERCEL_TEMP_TOKEN;
    }
    if (!token) {
      return NextResponse.json(
        { error: "Vercel token not configured" },
        { status: 401 },
      );
    }

    // Sanitize project name (same logic as deploy route)
    const sanitized =
      projectName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-")
        .slice(0, 100) || "flare-project";

    // Check if project exists
    const projectResp = await fetch(
      `${VERCEL_API_URL}/v9/projects/${sanitized}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!projectResp.ok) {
      return NextResponse.json({ deployments: [], projectExists: false });
    }

    const project = await projectResp.json();

    // Fetch deployments
    const deploymentsResp = await fetch(
      `${VERCEL_API_URL}/v6/deployments?projectId=${project.id}&limit=20`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!deploymentsResp.ok) {
      return NextResponse.json({ deployments: [], projectExists: true });
    }

    const { deployments } = await deploymentsResp.json();

    const mapped = (deployments || []).map((d: any) => ({
      id: d.uid,
      url: d.url ? `https://${d.url}` : null,
      state: d.state || d.readyState,
      createdAt: d.created || d.createdAt,
      meta: {
        gitCommitSha: d.meta?.githubCommitSha?.slice(0, 7),
        gitCommitMessage: d.meta?.githubCommitMessage,
        gitBranch: d.meta?.githubCommitRef,
      },
      target: d.target, // "production" or null
      errorMessage: d.errorMessage || null,
    }));

    return NextResponse.json({
      deployments: mapped,
      projectExists: true,
      projectId: project.id,
      productionUrl: `https://${sanitized}.vercel.app`,
    });
  } catch (error) {
    console.error("[DeployHistory] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 },
    );
  }
}
