import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_REDIRECT_URI =
  process.env.VERCEL_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/vercel/callback`;

function generateSecureRandomString(length: number): string {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const randomBytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomBytes, (byte) => charset[byte % charset.length]).join(
    "",
  );
}

/**
 * Initiate Vercel OAuth flow (PKCE + Authorization Code).
 *
 * GET /api/auth/vercel/login
 *
 * Generates PKCE code_verifier/code_challenge, stores verifier in a cookie,
 * and redirects (or returns JSON for popup mode) to Vercel's authorize endpoint.
 */
export async function GET(request: NextRequest) {
  if (!VERCEL_CLIENT_ID) {
    return NextResponse.json(
      {
        error:
          "VERCEL_CLIENT_ID is not configured. Ask your administrator to set up Vercel OAuth.",
      },
      { status: 500 },
    );
  }

  // Generate PKCE values
  const codeVerifier = crypto.randomBytes(43).toString("hex");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  // Generate state for CSRF protection
  const state = generateSecureRandomString(43);

  // Store code_verifier and state in cookies (10 min TTL)
  const cookieStore = await cookies();
  cookieStore.set("vercel_oauth_code_verifier", codeVerifier, {
    maxAge: 10 * 60,
    secure: true,
    httpOnly: true,
    sameSite: "lax",
  });
  cookieStore.set("vercel_oauth_state", state, {
    maxAge: 10 * 60,
    secure: true,
    httpOnly: true,
    sameSite: "lax",
  });

  const params = new URLSearchParams({
    client_id: VERCEL_CLIENT_ID,
    redirect_uri: VERCEL_REDIRECT_URI,
    response_type: "code",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    scope: "openid email profile offline_access",
  });

  const authUrl = `https://vercel.com/oauth/authorize?${params.toString()}`;

  // If popup mode requested, return JSON with the URL
  const isPopup = request.nextUrl.searchParams.get("popup") === "true";
  if (isPopup) {
    // For popup mode we still need to set cookies, so we return a redirect-style response
    // that the frontend will open in a popup window
    return NextResponse.json({ authUrl });
  }

  return NextResponse.redirect(authUrl);
}
