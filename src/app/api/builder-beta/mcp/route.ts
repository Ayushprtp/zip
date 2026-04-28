/**
 * Builder Beta MCP API Route
 * GET/POST /api/builder-beta/mcp
 *
 * Placeholder for Model Context Protocol endpoint.
 * Will be fully implemented in Phase 2.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Builder Beta MCP API',
    status: 'placeholder',
  });
}

export async function POST(request: NextRequest) {
  const _body = await request.json();

  // TODO: Port full MCP from builderbeta/app/routes/api.mcp.ts
  return NextResponse.json({
    success: false,
    error: 'Builder Beta MCP system not yet fully ported.',
  });
}
