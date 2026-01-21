/**
 * GitHub OAuth Handler
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/github/callback`;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    // Redirect to GitHub OAuth
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID || "");
    authUrl.searchParams.set("redirect_uri", GITHUB_REDIRECT_URI);
    authUrl.searchParams.set("scope", "repo user");

    return NextResponse.redirect(authUrl.toString());
  }

  // Exchange code for token
  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI,
        }),
      },
    );

    const data = await tokenResponse.json();

    if (data.error) {
      return NextResponse.json(
        { error: data.error_description },
        { status: 400 },
      );
    }

    // Store token in httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set("github_token", data.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({ success: true, token: data.access_token });
  } catch (error: any) {
    console.error("GitHub OAuth error:", error);
    return NextResponse.json(
      { error: error.message || "Authentication failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 400 },
      );
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Token deletion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete token" },
      { status: 500 },
    );
  }
}
