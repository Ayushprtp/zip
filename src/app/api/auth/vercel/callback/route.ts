import { type NextRequest, NextResponse } from "next/server";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET;
const VERCEL_REDIRECT_URI =
  process.env.VERCEL_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/vercel/callback`;

/**
 * Vercel OAuth callback — exchanges the authorization code for an access token.
 *
 * Supports two modes:
 *  1. **Popup mode** (default): Returns an HTML page that posts a message back
 *     to the parent window and auto-closes. This mirrors the GitHub OAuth popup flow.
 *  2. **Redirect mode** (fallback): If opened directly (no `window.opener`),
 *     redirects to /builder with the token set as a cookie.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
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

  try {
    const params = new URLSearchParams({
      client_id: VERCEL_CLIENT_ID,
      client_secret: VERCEL_CLIENT_SECRET,
      code,
      redirect_uri: VERCEL_REDIRECT_URI,
    });

    const response = await fetch(
      "https://api.vercel.com/v2/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      },
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[Vercel OAuth] Token exchange failed:", err);
      return new NextResponse(
        buildPopupHTML(false, err.error_description || "Token exchange failed"),
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

    // Set the vercel_token cookie (30 days)
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    const res = new NextResponse(buildPopupHTML(true), {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });

    res.cookies.set("vercel_token", accessToken, {
      httpOnly: false, // Accessible by frontend JS for cookie checks
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
      sameSite: "strict",
    });

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
