/**
 * Vercel Deployments API
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { VercelService } from "@/lib/builder/vercel-service";

async function getVercelToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vercel_token")?.value || null;
}

export async function GET(request: NextRequest) {
  try {
    const token = await getVercelToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const projectId = request.nextUrl.searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const vercel = new VercelService(token);
    const deployments = await vercel.getDeployments(projectId);

    return NextResponse.json({ deployments });
  } catch (error: any) {
    console.error("List deployments error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list deployments" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getVercelToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { projectId, gitSource } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 },
      );
    }

    const vercel = new VercelService(token);
    const deployment = await vercel.createDeployment(projectId, gitSource);

    return NextResponse.json({ deployment });
  } catch (error: any) {
    console.error("Create deployment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create deployment" },
      { status: 500 },
    );
  }
}
