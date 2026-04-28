/**
 * User Connections API
 *
 * GET  /api/user/connections — Get all connected services
 * PUT  /api/user/connections — Update a specific connection
 * DELETE /api/user/connections — Remove a specific connection
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "auth/server";
import { userRepository } from "lib/db/repository";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const prefs = (await userRepository.getPreferences(session.user.id)) || {};

    return NextResponse.json({
      connections: {
        github: {
          connected: !!prefs.githubToken,
          username: prefs.githubUsername || null,
          installationId: prefs.githubInstallationId || null,
        },
        vercel: {
          connected: !!prefs.vercelToken,
          // Mask token for display (show last 6 chars)
          tokenHint: prefs.vercelToken
            ? `...${prefs.vercelToken.slice(-6)}`
            : null,
        },
      },
    });
  } catch (error: any) {
    console.error("Connections GET error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get connections" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { service, token, installationId, username } = body;

    if (!service || !["github", "vercel"].includes(service)) {
      return NextResponse.json(
        { error: "Invalid service. Must be 'github' or 'vercel'" },
        { status: 400 },
      );
    }

    const currentPrefs =
      (await userRepository.getPreferences(session.user.id)) || {};

    if (service === "vercel") {
      if (!token) {
        return NextResponse.json(
          { error: "Token is required" },
          { status: 400 },
        );
      }
      await userRepository.updatePreferences(session.user.id, {
        ...currentPrefs,
        vercelToken: token,
      });

      // Also set cookie for immediate use
      const cookieStore = await cookies();
      cookieStore.set("vercel_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    } else if (service === "github") {
      if (!token) {
        return NextResponse.json(
          { error: "Token is required" },
          { status: 400 },
        );
      }
      await userRepository.updatePreferences(session.user.id, {
        ...currentPrefs,
        githubToken: token,
        ...(installationId ? { githubInstallationId: installationId } : {}),
        ...(username ? { githubUsername: username } : {}),
      });

      // Also set cookies for immediate use
      const cookieStore = await cookies();
      cookieStore.set("github_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
      if (installationId) {
        cookieStore.set("github_installation_id", String(installationId), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Connections PUT error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update connection" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const service = searchParams.get("service");

    if (!service || !["github", "vercel"].includes(service)) {
      return NextResponse.json(
        { error: "Invalid service. Must be 'github' or 'vercel'" },
        { status: 400 },
      );
    }

    const currentPrefs =
      (await userRepository.getPreferences(session.user.id)) || {};
    const cookieStore = await cookies();

    if (service === "vercel") {
      await userRepository.updatePreferences(session.user.id, {
        ...currentPrefs,
        vercelToken: undefined,
      });
      cookieStore.delete("vercel_token");
    } else if (service === "github") {
      await userRepository.updatePreferences(session.user.id, {
        ...currentPrefs,
        githubToken: undefined,
        githubInstallationId: undefined,
        githubUsername: undefined,
      });
      cookieStore.delete("github_token");
      cookieStore.delete("github_installation_id");
      cookieStore.delete("github_refresh_token");
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Connections DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to remove connection" },
      { status: 500 },
    );
  }
}
