import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const IMAGES_DIR = join(process.cwd(), ".data", "images");

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Serves generated images from local storage.
 * URL pattern: /api/images/{username}/{filename}.{ext}
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const segments = (await params).path;

  if (!segments || segments.length < 2) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Prevent directory traversal
  if (segments.some((s) => s.includes("..") || s.includes("~"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const filePath = join(IMAGES_DIR, ...segments);

  if (!filePath.startsWith(IMAGES_DIR)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const data = await readFile(filePath);
    const ext = filePath.substring(filePath.lastIndexOf(".")).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(data.byteLength),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to read image" },
      { status: 500 },
    );
  }
}
