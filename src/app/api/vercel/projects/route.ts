/**
 * Vercel Projects API
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { VercelService } from "@/lib/builder/vercel-service";

async function getVercelToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("vercel_token")?.value || null;
}

export async function GET() {
  try {
    const token = await getVercelToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const vercel = new VercelService(token);
    const projects = await vercel.listProjects();

    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error("List projects error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list projects" },
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

    const {
      name,
      framework,
      buildCommand,
      outputDirectory,
      gitRepository,
      environmentVariables,
    } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 },
      );
    }

    const vercel = new VercelService(token);
    const project = await vercel.createProject({
      name,
      framework,
      buildCommand,
      outputDirectory,
      gitRepository,
      environmentVariables,
    });

    return NextResponse.json({ project });
  } catch (error: any) {
    console.error("Create project error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create project" },
      { status: 500 },
    );
  }
}
