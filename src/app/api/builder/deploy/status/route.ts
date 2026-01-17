/**
 * Deployment Status API Endpoint
 *
 * Checks the status of a deployment on Netlify/Vercel.
 * Used for polling deployment progress.
 *
 * Requirements: 14.5
 */

import { NextRequest, NextResponse } from "next/server";

// Netlify API configuration
const NETLIFY_API_URL = "https://api.netlify.com/api/v1";
const NETLIFY_TOKEN = process.env.NETLIFY_ACCESS_TOKEN;

// Vercel API configuration
const VERCEL_API_URL = "https://api.vercel.com";
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;

/**
 * GET /api/builder/deploy/status?deploymentId=xxx&platform=netlify
 *
 * Checks the status of a deployment
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const deploymentId = searchParams.get("deploymentId");
    const platform = searchParams.get("platform") || "netlify";

    if (!deploymentId) {
      return NextResponse.json(
        { error: "Deployment ID is required" },
        { status: 400 },
      );
    }

    // Check status on the specified platform
    let result;
    if (platform === "netlify") {
      result = await checkNetlifyStatus(deploymentId);
    } else if (platform === "vercel") {
      result = await checkVercelStatus(deploymentId);
    } else {
      return NextResponse.json(
        { error: "Unsupported platform" },
        { status: 400 },
      );
    }

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
 * Check Netlify deployment status
 */
async function checkNetlifyStatus(deploymentId: string): Promise<any> {
  if (!NETLIFY_TOKEN) {
    throw new Error("Netlify access token not configured");
  }

  const response = await fetch(`${NETLIFY_API_URL}/deploys/${deploymentId}`, {
    headers: {
      Authorization: `Bearer ${NETLIFY_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to check Netlify deployment status");
  }

  const deployment = await response.json();

  // Map Netlify states to our status format
  let status = "building";
  if (deployment.state === "ready") {
    status = "ready";
  } else if (deployment.state === "error") {
    status = "error";
  }

  return {
    status,
    url: deployment.ssl_url || deployment.url,
    logs: deployment.error_message ? [deployment.error_message] : [],
    error: deployment.error_message,
  };
}

/**
 * Check Vercel deployment status
 */
async function checkVercelStatus(deploymentId: string): Promise<any> {
  if (!VERCEL_TOKEN) {
    throw new Error("Vercel token not configured");
  }

  const response = await fetch(
    `${VERCEL_API_URL}/v13/deployments/${deploymentId}`,
    {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
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
