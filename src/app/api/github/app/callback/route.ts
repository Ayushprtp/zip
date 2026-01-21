/**
 * GitHub App OAuth Callback Handler
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GitHubAppService } from "@/lib/builder/github-app-service";

const GITHUB_APP_ID = process.env.GITHUB_APP_ID!;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY!;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID!;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET!;

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const installationId = request.nextUrl.searchParams.get("installation_id");
    const setupAction = request.nextUrl.searchParams.get("setup_action");

    if (!code) {
      return NextResponse.json(
        { error: "Missing authorization code" },
        { status: 400 },
      );
    }

    // Initialize GitHub App service
    const githubApp = new GitHubAppService({
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_APP_PRIVATE_KEY,
      clientId: GITHUB_APP_CLIENT_ID,
      clientSecret: GITHUB_APP_CLIENT_SECRET,
    });

    // Exchange code for token
    const { token, refreshToken, expiresAt } =
      await githubApp.exchangeCodeForToken(code);

    // Store tokens in httpOnly cookies
    const cookieStore = await cookies();
    cookieStore.set("github_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    if (refreshToken) {
      cookieStore.set("github_refresh_token", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 180, // 180 days
      });
    }

    if (installationId) {
      cookieStore.set("github_installation_id", installationId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    // Redirect back to the app
    const redirectUrl = new URL("/builder", process.env.NEXT_PUBLIC_APP_URL!);
    redirectUrl.searchParams.set("github_connected", "true");

    if (setupAction === "install") {
      redirectUrl.searchParams.set("setup", "complete");
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error("GitHub App callback error:", error);

    const errorUrl = new URL("/builder", process.env.NEXT_PUBLIC_APP_URL!);
    errorUrl.searchParams.set("error", "github_auth_failed");
    errorUrl.searchParams.set("message", error.message || "Authentication failed");

    return NextResponse.redirect(errorUrl);
  }
}
