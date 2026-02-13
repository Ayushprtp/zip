import { streamText } from "ai";
import { customModelProvider } from "@/lib/ai/models";
import { getSession } from "auth/server";
import { getUserApiKeys } from "@/lib/ai/user-api-keys";

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session?.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { prompt, system, messages, provider, model } = await request.json();

    if (!provider || !model) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Require either prompt (legacy) or messages (new)
    if (!prompt && (!messages || messages.length === 0)) {
      return new Response("Missing prompt or messages", { status: 400 });
    }

    // Get user's personal API keys
    const userApiKeys = await getUserApiKeys();
    const aiModel = customModelProvider.getModel(
      { provider, model },
      userApiKeys,
    );

    // Support both legacy single-prompt and new messages format
    if (messages && messages.length > 0) {
      const result = streamText({
        model: aiModel,
        system: system || undefined,
        messages,
        maxRetries: 2,
      });
      return result.toTextStreamResponse();
    }

    // Legacy: single prompt mode
    const result = streamText({
      model: aiModel,
      prompt,
      maxRetries: 2,
    });

    return result.toTextStreamResponse();
  } catch (error: any) {
    console.error("Builder AI generation error:", error);
    return Response.json(
      { error: error.message || "Failed to generate code" },
      { status: 500 },
    );
  }
}
