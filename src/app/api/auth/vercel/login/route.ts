import { type NextRequest, NextResponse } from "next/server";

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID;
const VERCEL_REDIRECT_URI =
  process.env.VERCEL_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/vercel/callback`;

export async function GET(_request: NextRequest) {
  if (!VERCEL_CLIENT_ID) {
    return NextResponse.json(
      { error: "VERCEL_CLIENT_ID is not configured" },
      { status: 500 },
    );
  }

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).substring(7);

  // Store state in cookie (optional but recommended)
  // For simplicity, we'll just redirect now.

  const params = new URLSearchParams({
    client_id: VERCEL_CLIENT_ID,
    state,
    redirect_uri: VERCEL_REDIRECT_URI,
  });

  return NextResponse.redirect(
    `https://vercel.com/oauth/authorize?${params.toString()}`,
  );
}
