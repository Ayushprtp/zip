/**
 * GitHub OAuth Handler
 *
 * Initiates the GitHub App OAuth flow and handles token storage.
 * The actual OAuth callback with code exchange is handled at /api/github/app/callback.
 *
 * GET  → Redirect to GitHub App OAuth (starts the flow)
 * POST → Store a token in httpOnly cookie (manual token entry)
 * DELETE → Clear stored GitHub tokens
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Use GitHub App credentials for OAuth
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID;
const GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL}api/github/app/callback`;

export async function GET() {
  if (!GITHUB_APP_CLIENT_ID) {
    return NextResponse.json(
      { error: "GitHub App not configured" },
      { status: 500 },
    );
  }

  // Redirect to GitHub App OAuth authorization
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", GITHUB_APP_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", GITHUB_REDIRECT_URI);
  // Request minimal scopes — the GitHub App installation provides repo access
  authUrl.searchParams.set("scope", "repo read:user user:email");

  return NextResponse.redirect(authUrl.toString());
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Store token in httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("github_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

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
    cookieStore.delete("github_token");
    cookieStore.delete("github_refresh_token");
    cookieStore.delete("github_installation_id");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Token deletion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete token" },
      { status: 500 },
    );
  }
}
