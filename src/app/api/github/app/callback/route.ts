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
    const { token, refreshToken } = await githubApp.exchangeCodeForToken(code);

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

    let finalInstallationId = installationId;

    if (!finalInstallationId) {
      try {
        // If coming from a standard OAuth flow (not a fresh install),
        // we need to find the user's installation ID manually.
        const installations = await githubApp.getUserInstallations(token);
        if (installations.length > 0) {
          const user = await githubApp.getAuthenticatedUser(token);
          // Prefer installation on the user's own account
          const userInstallation = installations.find(
            (inst) => inst.account.login === user.login,
          );
          finalInstallationId = userInstallation
            ? userInstallation.id.toString()
            : installations[0].id.toString();
        }
      } catch (err) {
        console.warn("Failed to auto-detect GitHub installation:", err);
      }
    }

    if (finalInstallationId) {
      cookieStore.set("github_installation_id", finalInstallationId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    // Instead of redirecting, return an HTML page that closes the popup
    // and notifies the parent window.
    const html = `<!DOCTYPE html>
<html><head><title>GitHub Connected</title></head>
<body>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "github-auth-success" }, "*");
  }
  window.close();
</script>
<p>Authentication successful! This window should close automatically.</p>
<p>If it doesn't, you can <a href="#" onclick="window.close()">close it manually</a>.</p>
</body></html>`;

    return new Response(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error: any) {
    console.error("GitHub App callback error:", error);

    const errorUrl = new URL("/builder", process.env.NEXT_PUBLIC_APP_URL!);
    errorUrl.searchParams.set("error", "github_auth_failed");
    errorUrl.searchParams.set(
      "message",
      error.message || "Authentication failed",
    );

    return NextResponse.redirect(errorUrl);
  }
}
