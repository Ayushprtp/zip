import { getSession } from "auth/server";
import {
  classifyIntent,
  resolveModelWithFallback,
} from "lib/ai/agent/intent-classifier";
import { customModelProvider } from "lib/ai/models";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { message, hasAttachments } = await request.json();

    if (!message || typeof message !== "string") {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    // Classify the intent
    let classification = classifyIntent(message, hasAttachments ?? false);

    // Resolve against available models
    const availableModels = customModelProvider.modelsInfo;
    classification = resolveModelWithFallback(classification, availableModels);

    return Response.json(classification);
  } catch (error: any) {
    console.error("Auto-route error:", error);
    return Response.json(
      { error: error.message || "Failed to classify intent" },
      { status: 500 },
    );
  }
}
