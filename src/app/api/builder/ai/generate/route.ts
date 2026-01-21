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

    const { prompt, provider, model } = await request.json();

    if (!prompt || !provider || !model) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Get user's personal API keys
    const userApiKeys = await getUserApiKeys();
    const aiModel = customModelProvider.getModel(
      { provider, model },
      userApiKeys,
    );

    // Stream the response
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
