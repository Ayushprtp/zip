/**
 * Vercel Token Management
 *
 * Stores Vercel token in:
 *   1. httpOnly cookie (for immediate API use)
 *   2. User preferences in DB (for persistence across sessions)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "auth/server";
import { userRepository } from "lib/db/repository";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Store token in httpOnly cookie (for immediate use)
    const cookieStore = await cookies();
    cookieStore.set("vercel_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year (DB is the real persistence)
    });

    // Also persist to user preferences in DB
    const session = await getSession();
    if (session?.user?.id) {
      try {
        const currentPrefs =
          (await userRepository.getPreferences(session.user.id)) || {};
        await userRepository.updatePreferences(session.user.id, {
          ...currentPrefs,
          vercelToken: token,
        });
      } catch (dbErr) {
        console.warn("[Vercel Auth] Failed to persist token to DB:", dbErr);
        // Cookie still works, just won't survive cookie clear
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Token storage error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to store token" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete("vercel_token");

    // Also remove from DB
    const session = await getSession();
    if (session?.user?.id) {
      try {
        const currentPrefs =
          (await userRepository.getPreferences(session.user.id)) || {};
        await userRepository.updatePreferences(session.user.id, {
          ...currentPrefs,
          vercelToken: undefined,
        });
      } catch (dbErr) {
        console.warn("[Vercel Auth] Failed to remove token from DB:", dbErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Token deletion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete token" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get("vercel_token")?.value;

    // If no cookie, try to restore from DB
    if (!token) {
      const session = await getSession();
      if (session?.user?.id) {
        const prefs = await userRepository.getPreferences(session.user.id);
        if (prefs?.vercelToken) {
          token = prefs.vercelToken;
          // Restore cookie from DB
          cookieStore.set("vercel_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365,
          });
        }
      }
    }

    return NextResponse.json({ hasToken: !!token });
  } catch (error: any) {
    console.error("Token check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check token" },
      { status: 500 },
    );
  }
}
