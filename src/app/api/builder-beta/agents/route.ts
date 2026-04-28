/**
 * Builder Beta Agents API Route
 * GET/POST /api/builder-beta/agents
 *
 * Placeholder for agent execution endpoint.
 * Will be fully implemented in Phase 2.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    agents: [
      { name: 'coder', description: 'Expert coding agent' },
      { name: 'explorer', description: 'Codebase exploration agent' },
      { name: 'reviewer', description: 'Code review agent' },
      { name: 'architect', description: 'Architecture design agent' },
      { name: 'debugger', description: 'Debugging specialist agent' },
      { name: 'planner', description: 'Task planning agent' },
    ],
    status: 'placeholder',
  });
}

export async function POST(request: NextRequest) {
  const _body = await request.json();

  // TODO: Port full agent execution from builderbeta/app/routes/api.agents.ts
  return NextResponse.json({
    success: false,
    error: 'Builder Beta agents system not yet fully ported.',
  });
}
