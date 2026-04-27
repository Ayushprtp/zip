import { type NextRequest, NextResponse } from "next/server";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_REDIRECT_URI =
  process.env.VERCEL_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/vercel/callback`;

/**
 * Initiate Vercel OAuth flow.
 *
 * GET /api/auth/vercel/login
 *
 * If the `popup=true` query param is set, returns a JSON response with the
 * auth URL (the frontend opens it in a popup). Otherwise, does a 302 redirect.
 */
export async function GET(request: NextRequest) {
  if (!VERCEL_CLIENT_ID) {
    return NextResponse.json(
      {
        error:
          "VERCEL_CLIENT_ID is not configured. Ask your administrator to set up Vercel OAuth, or use the centralized Vercel account by setting VERCEL_TEMP_TOKEN.",
      },
      { status: 500 },
    );
  }

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).substring(7);

  const params = new URLSearchParams({
    client_id: VERCEL_CLIENT_ID,
    state,
    redirect_uri: VERCEL_REDIRECT_URI,
  });

  const authUrl = `https://vercel.com/oauth/authorize?${params.toString()}`;

  // If popup mode requested, return JSON with the URL
  const isPopup = request.nextUrl.searchParams.get("popup") === "true";
  if (isPopup) {
    return NextResponse.json({ authUrl });
  }

  return NextResponse.redirect(authUrl);
}
