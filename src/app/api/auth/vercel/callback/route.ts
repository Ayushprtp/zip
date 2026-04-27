import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET;
const VERCEL_REDIRECT_URI =
  process.env.VERCEL_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/vercel/callback`;

/**
 * Vercel OAuth callback — exchanges the authorization code for tokens
 * using PKCE (code_verifier from cookie) and the new Vercel token endpoint.
 *
 * Supports popup mode: posts a message back to the parent window and auto-closes.
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
      buildPopupHTML(false, `Vercel authorization failed: ${errorDescription}`),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  if (!code) {
    return new NextResponse(
      buildPopupHTML(false, "No authorization code received from Vercel"),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  if (!VERCEL_CLIENT_ID || !VERCEL_CLIENT_SECRET) {
    return new NextResponse(
      buildPopupHTML(
        false,
        "Vercel OAuth is not configured on the server. Set VERCEL_CLIENT_ID and VERCEL_CLIENT_SECRET.",
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
      buildPopupHTML(false, "OAuth state mismatch — please try again."),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }

  if (!codeVerifier) {
    console.warn(
      "[Vercel OAuth] No code_verifier cookie found — PKCE may fail",
    );
  }

  try {
    // Exchange code for tokens using the NEW Vercel token endpoint
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
          err.error_description || err.error || "Token exchange failed",
        ),
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    const data = await response.json();
    const accessToken = data.access_token;

    if (!accessToken) {
      return new NextResponse(
        buildPopupHTML(false, "No access token received"),
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    // Clear PKCE cookies
    const res = new NextResponse(buildPopupHTML(true), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

    // Set the vercel_token cookie (30 days)
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    res.cookies.set("vercel_token", accessToken, {
      httpOnly: false, // Accessible by frontend JS for cookie checks
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
      sameSite: "lax",
    });

    // Clean up PKCE cookies
    res.cookies.set("vercel_oauth_code_verifier", "", { maxAge: 0 });
    res.cookies.set("vercel_oauth_state", "", { maxAge: 0 });

    return res;
  } catch (error) {
    console.error("[Vercel OAuth] Callback error:", error);
    return new NextResponse(
      buildPopupHTML(
        false,
        error instanceof Error ? error.message : "Internal Server Error",
      ),
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }
}

/**
 * Build HTML that posts a message to the opener and auto-closes.
 * If no opener (direct navigation), redirects to /builder.
 */
function buildPopupHTML(success: boolean, errorMsg?: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Vercel Auth</title></head>
<body>
  <p>${success ? "✅ Vercel connected! This window will close automatically." : `❌ ${errorMsg || "Authentication failed"}`}</p>
  <script>
    (function() {
      try {
        if (window.opener) {
          window.opener.postMessage(
            { type: "${success ? "vercel-auth-success" : "vercel-auth-error"}", error: ${JSON.stringify(errorMsg || "")} },
            window.location.origin
          );
          setTimeout(function() { window.close(); }, 500);
        } else {
          // No opener — redirect to builder
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
