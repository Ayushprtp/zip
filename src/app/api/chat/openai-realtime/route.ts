import { NextRequest } from "next/server";
import { getSession } from "auth/server";
import { getUserApiKeys } from "lib/ai/user-api-keys";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { model = "gpt-4o-realtime-preview", voice = "alloy" } =
      await req.json();

    // Resolve API key: user personal key > env OPENAI_API_KEY > custom Gemini key
    const userKeys = await getUserApiKeys();
    const apiKey =
      userKeys?.openAIKey ||
      (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "****"
        ? process.env.OPENAI_API_KEY
        : null) ||
      process.env.CUSTOM_GEMINI_API_KEY;

    // Resolve base URL: use custom base URL if falling back to custom Gemini key
    const useCustomBase =
      !userKeys?.openAIKey &&
      (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "****");
    const baseURL = useCustomBase
      ? process.env.CUSTOM_GEMINI_BASE_URL || "https://api.flare-sh.tech/v1"
      : "https://api.openai.com/v1";

    if (!apiKey) {
      return Response.json(
        {
          error: {
            message:
              "No API key configured for voice chat. Set OPENAI_API_KEY or CUSTOM_GEMINI_API_KEY in your environment, or add a personal OpenAI key in settings.",
          },
        },
        { status: 400 },
      );
    }

    const response = await fetch(`${baseURL}/realtime/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
        modalities: ["audio", "text"],
        instructions: "You are a helpful assistant.",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(error, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error: any) {
    return new Response(error.message, { status: 500 });
  }
}
