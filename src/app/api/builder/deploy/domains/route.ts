/**
 * Domain Management API
 *
 * GET  /api/builder/deploy/domains?projectName=xxx   — List domains
 * POST /api/builder/deploy/domains { projectName, domain } — Add domain
 * DELETE /api/builder/deploy/domains { projectName, domain } — Remove domain
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VERCEL_API_URL = "https://api.vercel.com";
const VERCEL_TEMP_TOKEN = process.env.VERCEL_TEMP_TOKEN;

async function resolveToken(isTemporary?: boolean): Promise<string | null> {
  const cookieStore = await cookies();
  let token = cookieStore.get("vercel_token")?.value;
  if (!token && isTemporary && VERCEL_TEMP_TOKEN) token = VERCEL_TEMP_TOKEN;
  return token || null;
}

function sanitize(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-")
      .slice(0, 100) || "flare-project"
  );
}

// GET — List domains
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const projectName = sp.get("projectName");
    const isTemporary = sp.get("isTemporary") === "true";

    if (!projectName)
      return NextResponse.json(
        { error: "Project name required" },
        { status: 400 },
      );

    const token = await resolveToken(isTemporary);
    if (!token)
      return NextResponse.json(
        { error: "Vercel token not configured" },
        { status: 401 },
      );

    const sanitized = sanitize(projectName);

    const resp = await fetch(
      `${VERCEL_API_URL}/v9/projects/${sanitized}/domains`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!resp.ok) {
      if (resp.status === 404) return NextResponse.json({ domains: [] });
      throw new Error("Failed to fetch domains");
    }

    const data = await resp.json();
    const domains = (data.domains || []).map((d: any) => ({
      name: d.name,
      verified: d.verified,
      configured: d.configured !== false,
      gitBranch: d.gitBranch || null,
    }));

    return NextResponse.json({ domains });
  } catch (error) {
    console.error("[Domains] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}

// POST — Add domain
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectName, domain, isTemporary } = body;

    if (!projectName || !domain)
      return NextResponse.json(
        { error: "Project name and domain required" },
        { status: 400 },
      );

    const token = await resolveToken(isTemporary);
    if (!token)
      return NextResponse.json(
        { error: "Vercel token not configured" },
        { status: 401 },
      );

    const sanitized = sanitize(projectName);

    const resp = await fetch(
      `${VERCEL_API_URL}/v10/projects/${sanitized}/domains`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: domain }),
      },
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to add domain");
    }

    const result = await resp.json();
    return NextResponse.json({
      domain: {
        name: result.name,
        verified: result.verified,
        configured: result.configured !== false,
      },
    });
  } catch (error) {
    console.error("[Domains] Add error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}

// DELETE — Remove domain
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectName, domain, isTemporary } = body;

    if (!projectName || !domain)
      return NextResponse.json(
        { error: "Project name and domain required" },
        { status: 400 },
      );

    const token = await resolveToken(isTemporary);
    if (!token)
      return NextResponse.json(
        { error: "Vercel token not configured" },
        { status: 401 },
      );

    const sanitized = sanitize(projectName);

    const resp = await fetch(
      `${VERCEL_API_URL}/v9/projects/${sanitized}/domains/${domain}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || "Failed to remove domain");
    }

    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("[Domains] Remove error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
