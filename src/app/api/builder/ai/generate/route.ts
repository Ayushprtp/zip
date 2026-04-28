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

    let aiModel;
    try {
      aiModel = customModelProvider.getModel({ provider, model }, userApiKeys);
    } catch (modelErr: any) {
      console.error("Model lookup error:", modelErr);
      return new Response(
        JSON.stringify({
          error: `Model not found: ${provider}/${model}. ${modelErr.message}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Support both legacy single-prompt and new messages format
    const streamOpts =
      messages && messages.length > 0
        ? {
            model: aiModel,
            system: system || undefined,
            messages,
            maxRetries: 2,
          }
        : { model: aiModel, prompt, maxRetries: 2 };

    const result = streamText(streamOpts);

    // Use a custom ReadableStream that wraps the text stream and catches errors.
    // The AI SDK's toTextStreamResponse() swallows upstream model errors,
    // so the client receives an empty body with 200 OK. Instead, we read the
    // text stream ourselves and forward chunks, catching errors in-flight.
    const textStream = result.textStream;
    let hasEmittedAny = false;

    const outputStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          for await (const chunk of textStream) {
            hasEmittedAny = true;
            controller.enqueue(encoder.encode(chunk));
          }
          // If the stream ended without emitting any text, send an error message
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

          // Determine user-friendly error message
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
            // No text was sent yet — send the error as the response body
            controller.enqueue(encoder.encode(userMessage));
          } else {
            // Some text was sent — append the error notice
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
  } catch (error: any) {
    console.error("Builder AI generation error:", error);

    // Return a plain text error so the client can display it in the chat
    const errorMsg = error.message || "Failed to generate code";
    let userMessage = `⚠️ Error: ${errorMsg}`;
    if (
      errorMsg.includes("Unknown provider") ||
      errorMsg.includes("Unknown model")
    ) {
      userMessage = `⚠️ Model not available: ${errorMsg}. Please switch to a different model.`;
    }

    return new Response(userMessage, {
      status: 200, // Return 200 so client reads it as AI response text
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
