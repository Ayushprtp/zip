/**
 * Deployment Status API Endpoint
 *
 * Checks the status of a deployment on Vercel.
 * Used for polling deployment progress.
 * Returns build logs for both building and error states.
 *
 * Requirements: 14.5
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Vercel API configuration
const VERCEL_API_URL = "https://api.vercel.com";

/**
 * Token used for deploying temporary workspace projects.
 * Must match the token used in the deploy route.
 */
const VERCEL_TEMP_TOKEN = process.env.VERCEL_TEMP_TOKEN;

/**
 * GET /api/builder/deploy/status?deploymentId=xxx&platform=vercel&isTemporary=true
 *
 * Checks the status of a Vercel deployment.
 * Pass isTemporary=true for temporary workspace deployments so the server
 * uses VERCEL_TEMP_TOKEN instead of the per-user cookie.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deploymentId = searchParams.get("deploymentId");
    const isTemporary = searchParams.get("isTemporary") === "true";

    if (!deploymentId) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 },
      );
    }

    const result = await checkVercelStatus(deploymentId, isTemporary);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Status check error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to check status",
        status: "error",
      },
      { status: 500 },
    );
  }
}

/**
 * Check Vercel deployment status.
 *
 * Token resolution order (mirrors the deploy route):
 *   1. User's Vercel token from cookies (personal account)
 *   2. For temporary-workspace projects: VERCEL_TEMP_TOKEN env var
 *   3. If neither is available → error
 *
 * Returns build logs for both "building" and "error" states.
 */
async function checkVercelStatus(
  deploymentId: string,
  isTemporary: boolean,
): Promise<any> {
  const cookieStore = await cookies();
  let token = cookieStore.get("vercel_token")?.value;

  // For temporary workspace projects, fall back to the server-side env token
  if (!token && isTemporary && VERCEL_TEMP_TOKEN) {
    token = VERCEL_TEMP_TOKEN;
  }

  if (!token) {
    throw new Error("Vercel token not configured");
  }

  const response = await fetch(
    `${VERCEL_API_URL}/v13/deployments/${deploymentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to check Vercel deployment status");
  }

  const deployment = await response.json();

  // Map Vercel states to our status format
  let status = "building";
  if (deployment.readyState === "READY") {
    status = "ready";
  } else if (deployment.readyState === "ERROR") {
    status = "error";
  }

  // Fetch build logs for both "building" and "error" states
  let logs: string[] = [];
  if (status === "building" || status === "error") {
    try {
      const eventsResponse = await fetch(
        `${VERCEL_API_URL}/v3/deployments/${deploymentId}/events`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        // Filter to build output lines — Vercel events have `type` and `text`
        logs = (Array.isArray(events) ? events : [])
          .filter(
            (e: any) =>
              e.type === "stdout" ||
              e.type === "stderr" ||
              e.type === "command",
          )
          .map((e: any) => e.text || e.payload?.text || "")
          .filter(Boolean)
          // Keep last 100 lines to avoid overwhelming the UI
          .slice(-100);
      }
    } catch (logErr) {
      console.warn("[DeployStatus] Failed to fetch build logs:", logErr);
    }
  }

  // Build a detailed error message from the deployment + logs
  let errorMessage = deployment.error?.message || undefined;
  if (status === "error" && !errorMessage && logs.length > 0) {
    const errorLines = logs.filter(
      (l) =>
        l.toLowerCase().includes("error") || l.toLowerCase().includes("failed"),
    );
    if (errorLines.length > 0) {
      errorMessage = errorLines[errorLines.length - 1];
    }
  }

  // Resolve the best URL — prefer production alias over per-deployment URL
  // The `alias` array contains production URLs like "project-name.vercel.app"
  // The `url` field is the per-deployment URL like "project-abc123.vercel.app"
  let resolvedUrl: string | null = null;
  if (
    deployment.alias &&
    Array.isArray(deployment.alias) &&
    deployment.alias.length > 0
  ) {
    // Pick the shortest alias (usually the .vercel.app one)
    const bestAlias = deployment.alias.sort(
      (a: string, b: string) => a.length - b.length,
    )[0];
    resolvedUrl = `https://${bestAlias}`;
  } else if (deployment.url) {
    resolvedUrl = `https://${deployment.url}`;
  }

  return {
    status,
    url: resolvedUrl,
    logs,
    error: errorMessage,
  };
}
