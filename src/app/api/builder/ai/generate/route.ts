import { streamText } from "ai";
import { customModelProvider } from "@/lib/ai/models";
import { getSession } from "auth/server";
import { getUserApiKeys } from "@/lib/ai/user-api-keys";

// Fallback models to try when the primary model fails
const FALLBACK_MODELS = [
  { provider: "deepseek", model: "deepseek-chat" },
  { provider: "qwen", model: "qwen-plus" },
  { provider: "google", model: "gemini-2.5-flash" },
  { provider: "glm", model: "glm-4-plus" },
];

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

    // Build list of models to try: primary + fallbacks
    const modelsToTry = [
      { provider, model },
      ...FALLBACK_MODELS.filter(
        (fb) => !(fb.provider === provider && fb.model === model),
      ),
    ];

    let lastError: string = "";

    for (const candidate of modelsToTry) {
      let aiModel;
      try {
        aiModel = customModelProvider.getModel(candidate, userApiKeys);
      } catch {
        // Model not available, skip to next
        continue;
      }

      try {
        // Support both legacy single-prompt and new messages format
        const streamOpts =
          messages && messages.length > 0
            ? {
                model: aiModel,
                system: system || undefined,
                messages,
                maxRetries: 1,
              }
            : { model: aiModel, prompt, maxRetries: 1 };

        const result = streamText(streamOpts);

        // Use a custom ReadableStream that wraps the text stream and catches errors.
        // The AI SDK's toTextStreamResponse() swallows upstream model errors,
        // so the client receives an empty body with 200 OK. Instead, we read the
        // text stream ourselves and forward chunks, catching errors in-flight.
        const textStream = result.textStream;
        let hasEmittedAny = false;
        let _collectedText = "";

        // Try to read the first chunk to detect immediate errors
        const reader = textStream[Symbol.asyncIterator]();
        const firstChunk = await Promise.race([
          reader.next(),
          new Promise<{ done: true; value: undefined }>((resolve) =>
            setTimeout(() => resolve({ done: true, value: undefined }), 15000),
          ),
        ]);

        if (firstChunk.done && !firstChunk.value) {
          // Stream ended immediately or timed out — model might be overloaded
          lastError = `Model ${candidate.provider}/${candidate.model} returned empty response`;
          console.warn(`[Builder AI] ${lastError}, trying next model...`);
          continue; // Try next model
        }

        // First chunk came through — stream the full response
        const outputStream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              // Emit the model being used if it's a fallback
              if (
                candidate.provider !== provider ||
                candidate.model !== model
              ) {
                const notice = `> 💡 Using **${candidate.provider}/${candidate.model}** (${provider}/${model} was unavailable)\n\n`;
                controller.enqueue(encoder.encode(notice));
              }

              // Emit the first chunk we already read
              if (firstChunk.value) {
                hasEmittedAny = true;
                _collectedText += firstChunk.value;
                controller.enqueue(encoder.encode(firstChunk.value));
              }

              // Continue reading the rest
              while (true) {
                const { done, value } = await reader.next();
                if (done) break;
                hasEmittedAny = true;
                _collectedText += value;
                controller.enqueue(encoder.encode(value));
              }

              if (!hasEmittedAny) {
                controller.enqueue(
                  encoder.encode(
                    "⚠️ The AI model returned an empty response. The model may be overloaded. Please try again or switch to a different model.",
                  ),
                );
              }
              controller.close();
            } catch (streamErr: any) {
              console.error("Builder AI stream error:", streamErr);
              const errorMsg =
                streamErr.message || "AI generation failed during streaming";

              let userMessage = `⚠️ Error: ${errorMsg}`;
              if (
                errorMsg.includes("overloaded") ||
                errorMsg.includes("cpu") ||
                errorMsg.includes("429") ||
                errorMsg.includes("rate")
              ) {
                userMessage =
                  "⚠️ The AI model is currently overloaded. Please wait a moment and try again, or switch to a different model using the model selector.";
              } else if (
                errorMsg.includes("API error") ||
                errorMsg.includes("500")
              ) {
                userMessage = `⚠️ The AI service returned an error. Please try again or switch models.\n\nDetails: ${errorMsg}`;
              }

              if (!hasEmittedAny) {
                controller.enqueue(encoder.encode(userMessage));
              } else {
                controller.enqueue(encoder.encode(`\n\n---\n${userMessage}`));
              }
              controller.close();
            }
          },
        });

        return new Response(outputStream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
            "Cache-Control": "no-cache",
          },
        });
      } catch (modelErr: any) {
        lastError = modelErr.message || "Model failed";
        console.warn(
          `[Builder AI] Model ${candidate.provider}/${candidate.model} failed: ${lastError}`,
        );
        // Try next model
        continue;
      }
    }

    // All models failed
    const userMessage =
      "⚠️ All AI models are currently unavailable or overloaded. Please wait a moment and try again.\n\n" +
      `Last error: ${lastError}`;

    return new Response(userMessage, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: any) {
    console.error("Builder AI generation error:", error);

    const errorMsg = error.message || "Failed to generate code";
    let userMessage = `⚠️ Error: ${errorMsg}`;
    if (
      errorMsg.includes("Unknown provider") ||
      errorMsg.includes("Unknown model")
    ) {
      userMessage = `⚠️ Model not available: ${errorMsg}. Please switch to a different model.`;
    }

    return new Response(userMessage, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
