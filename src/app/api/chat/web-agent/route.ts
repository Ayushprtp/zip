import { NextResponse } from "next/server";
import { WebAgentDefinition } from "lib/ai/agent/web-agent";

/**
 * GET /api/chat/web-agent
 *
 * Returns the built-in Web Agent definition so the chat route
 * can load its instructions (systemPrompt + mentions/tools) without
 * hitting the database.
 */
export async function GET() {
  return NextResponse.json(WebAgentDefinition);
}
