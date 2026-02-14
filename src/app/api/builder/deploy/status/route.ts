/**
 * Deployment Status API Endpoint
 *
 * Checks the status of a deployment on Vercel.
 * Used for polling deployment progress.
 *
 * Requirements: 14.5
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Vercel API configuration
const VERCEL_API_URL = "https://api.vercel.com";

/**
 * GET /api/builder/deploy/status?deploymentId=xxx&platform=vercel
 *
 * Checks the status of a Vercel deployment
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deploymentId = searchParams.get("deploymentId");

    if (!deploymentId) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 },
      );
    }

    const result = await checkVercelStatus(deploymentId);
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
 * Check Vercel deployment status using per-user token
 */
async function checkVercelStatus(deploymentId: string): Promise<any> {
  const cookieStore = await cookies();
  const token = cookieStore.get("vercel_token")?.value;

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

  return {
    status,
    url: deployment.url ? `https://${deployment.url}` : null,
    logs: [],
    error: deployment.error?.message,
  };
}
