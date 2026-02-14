/**
 * Git CORS Proxy
 * Forwards Git HTTP requests to GitHub with proper authentication
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 },
      );
    }

    // Get the request body
    const body = await request.arrayBuffer();

    // Forward the request to GitHub
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type":
          request.headers.get("content-type") ||
          "application/x-git-upload-pack-request",
        Authorization: request.headers.get("authorization") || "",
        "User-Agent": "git/isomorphic-git",
      },
      body,
    });

    // Get response data
    const data = await response.arrayBuffer();

    // Return with CORS headers
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/x-git-upload-pack-result",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error: any) {
    console.error("Git proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Proxy request failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");

    if (!url) {
      return NextResponse.json(
        { error: "Missing url parameter" },
        { status: 400 },
      );
    }

    // Forward the request to GitHub
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: request.headers.get("authorization") || "",
        "User-Agent": "git/isomorphic-git",
      },
    });

    // Get response data
    const data = await response.arrayBuffer();

    // Return with CORS headers
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ||
          "application/x-git-upload-pack-advertisement",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  } catch (error: any) {
    console.error("Git proxy error:", error);
    return NextResponse.json(
      { error: error.message || "Proxy request failed" },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
