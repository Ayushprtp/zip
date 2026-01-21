/**
 * Vercel Token Management
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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
    cookieStore.set("vercel_token", token, {
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
    cookieStore.delete("vercel_token");

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Token deletion error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete token" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("vercel_token")?.value;

    return NextResponse.json({ hasToken: !!token });
  } catch (error: any) {
    console.error("Token check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check token" },
      { status: 500 },
    );
  }
}
