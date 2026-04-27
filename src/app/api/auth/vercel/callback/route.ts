import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET;
const VERCEL_REDIRECT_URI =
  process.env.VERCEL_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/vercel/callback`;

/**
 * Vercel OAuth callback — exchanges the authorization code for tokens.
 *
 * IMPORTANT: The "Sign in with Vercel" OAuth token (vca_...) only has
 * identity scopes (openid, email, profile). It does NOT have permission
 * to create projects or trigger deployments via the Vercel REST API.
 *
 * Flow:
 *  1. Exchange code for access_token (identity verification)
 *  2. Fetch user info from the token
 *  3. Return user info to the frontend via postMessage
 *  4. The frontend will then prompt the user to create a Personal Access Token
 *     for actual deployment API access
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  // Handle OAuth errors (user denied, etc.)
  if (error) {
    const errorDescription =
      request.nextUrl.searchParams.get("error_description") || error;
    return new NextResponse(
      buildPopupHTML(
        false,
        undefined,
        `Vercel authorization failed: ${errorDescription}`,
      ),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  if (!code) {
    return new NextResponse(
      buildPopupHTML(
        false,
        undefined,
        "No authorization code received from Vercel",
      ),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  if (!VERCEL_CLIENT_ID || !VERCEL_CLIENT_SECRET) {
    return new NextResponse(
      buildPopupHTML(
        false,
        undefined,
        "Vercel OAuth is not configured on the server.",
      ),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  // Retrieve stored PKCE code_verifier and state from cookies
  const cookieStore = await cookies();
  const storedState = cookieStore.get("vercel_oauth_state")?.value;
  const codeVerifier = cookieStore.get("vercel_oauth_code_verifier")?.value;

  // Validate state for CSRF protection
  if (storedState && state !== storedState) {
    return new NextResponse(
      buildPopupHTML(
        false,
        undefined,
        "OAuth state mismatch — please try again.",
      ),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  try {
    // Exchange code for tokens using Vercel's token endpoint
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: VERCEL_CLIENT_ID,
      client_secret: VERCEL_CLIENT_SECRET,
      code,
      redirect_uri: VERCEL_REDIRECT_URI,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });

    const response = await fetch("https://api.vercel.com/login/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[Vercel OAuth] Token exchange failed:", err);
      return new NextResponse(
        buildPopupHTML(
          false,
          undefined,
          err.error_description || err.error || "Token exchange failed",
        ),
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    const data = await response.json();
    const accessToken = data.access_token;

    if (!accessToken) {
      return new NextResponse(
        buildPopupHTML(false, undefined, "No access token received"),
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    // Fetch user info using the OAuth token to get the username
    let username = "";
    try {
      const userInfoResp = await fetch(
        "https://api.vercel.com/login/oauth/userinfo",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      if (userInfoResp.ok) {
        const userInfo = await userInfoResp.json();
        username = userInfo.preferred_username || userInfo.name || "";
      }
    } catch {
      // Non-critical — just won't have the username
    }

    // Clean up PKCE cookies
    const res = new NextResponse(buildPopupHTML(true, username), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

    res.cookies.set("vercel_oauth_code_verifier", "", { maxAge: 0 });
    res.cookies.set("vercel_oauth_state", "", { maxAge: 0 });

    // Store the username so the UI can display it
    if (username) {
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      res.cookies.set("vercel_username", username, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires,
        sameSite: "lax",
      });
    }

    return res;
  } catch (error) {
    console.error("[Vercel OAuth] Callback error:", error);
    return new NextResponse(
      buildPopupHTML(
        false,
        undefined,
        error instanceof Error ? error.message : "Internal Server Error",
      ),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }
}

/**
 * Build HTML that posts a message to the opener and auto-closes.
 * The message includes the verified username so the frontend can show it
 * and prompt the user for a Personal Access Token.
 */
function buildPopupHTML(
  success: boolean,
  username?: string,
  errorMsg?: string,
): string {
  return `<!DOCTYPE html>
<html>
<head><title>Vercel Auth</title></head>
<body>
  <p>${success ? "✅ Vercel identity verified! This window will close automatically." : `❌ ${errorMsg || "Authentication failed"}`}</p>
  <script>
    (function() {
      try {
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "${success ? "vercel-auth-success" : "vercel-auth-error"}",
              username: ${JSON.stringify(username || "")},
              error: ${JSON.stringify(errorMsg || "")},
              needsToken: ${success ? "true" : "false"}
            },
            window.location.origin
          );
          setTimeout(function() { window.close(); }, 500);
        } else {
          window.location.href = "/builder";
        }
      } catch(e) {
        window.location.href = "/builder";
      }
    })();
  </script>
</body>
</html>`;
}
