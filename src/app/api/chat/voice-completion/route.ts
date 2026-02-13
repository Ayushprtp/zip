import { NextRequest } from "next/server";
import { getSession } from "auth/server";
import { customModelProvider, DEFAULT_CHAT_MODEL } from "lib/ai/models";
import { getUserApiKeys } from "lib/ai/user-api-keys";
import { generateText } from "ai";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const {
      messages,
      chatModel,
      systemPrompt = "You are a helpful voice assistant. Keep your responses concise and conversational since they will be spoken aloud. Avoid markdown formatting, code blocks, or long lists. IMPORTANT: You MUST always respond in English regardless of the language the user speaks in. Never respond in any other language.",
    } = await req.json();

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: { message: "Messages are required" } },
        { status: 400 },
      );
    }

    if (!chatModel?.provider || !chatModel?.model) {
      return Response.json(
        { error: { message: "chatModel with provider and model is required" } },
        { status: 400 },
      );
    }

    const userApiKeys = await getUserApiKeys();

    // Try the requested model, fall back to default if provider is unknown
    let model;
    try {
      model = customModelProvider.getModel(chatModel, userApiKeys);
    } catch (e: any) {
      console.warn(`Voice chat: ${e.message}, falling back to default model`);
      model = customModelProvider.getModel(DEFAULT_CHAT_MODEL, userApiKeys);
    }

    const result = await generateText({
      model,
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return Response.json({
      text: result.text,
      usage: result.usage,
    });
  } catch (error: any) {
    console.error("Voice completion error:", error);
    return Response.json(
      { error: { message: error.message || "Completion failed" } },
      { status: 500 },
    );
  }
}
