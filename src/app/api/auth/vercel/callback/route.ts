import { type NextRequest, NextResponse } from "next/server";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET;
const VERCEL_REDIRECT_URI =
  process.env.VERCEL_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/vercel/callback`;

/**
 * Exchange code for access token.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const _state = request.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  if (!VERCEL_CLIENT_ID || !VERCEL_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Vercel OAuth is not configured on the server" },
      { status: 500 },
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
      const error = await response.json();
      return NextResponse.json(
        { error: error.error_description || "Authentication failed" },
        { status: 400 },
      );
    }

    const data = await response.json();
    const accessToken = data.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: "No access token received" },
        { status: 500 },
      );
    }

    // Redirect to the builder with success message/param
    const redirectUrl = new URL("/builder", request.url);
    // Setting cookie on the server side response
    const res = NextResponse.redirect(redirectUrl);

    // Set cookie (valid for 30 days)
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    res.cookies.set("vercel_token", accessToken, {
      httpOnly: false, // Accessible by JS so existing frontend code can read it if needed
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
      sameSite: "strict",
    });

    return res;
  } catch (error) {
    console.error("Vercel OAuth error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal Server Error",
      },
      { status: 500 },
    );
  }
}
