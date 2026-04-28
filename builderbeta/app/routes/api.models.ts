import { type LoaderFunctionArgs, json } from "@remix-run/cloudflare";

export async function loader({ context }: LoaderFunctionArgs) {
  const cloudflareEnv = context.cloudflare?.env || {};
  const nodeEnv = typeof process !== "undefined" ? process.env : {};

  const apiKey =
    cloudflareEnv.OPENAI_API_KEY ||
    nodeEnv.OPENAI_API_KEY ||
    nodeEnv.VITE_OPENAI_API_KEY;
  const baseUrl =
    cloudflareEnv.OPENAI_API_BASE_URL ||
    nodeEnv.OPENAI_API_BASE_URL ||
    "https://api.flare-sh.tech/v1";

  if (!apiKey) {
    return json({ error: "API key not found" }, { status: 401 });
  }

  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch models");
    }

    const data: any = await response.json();

    // Exclude image/video generation models, keep all LLMs
    const excludeKeywords = [
      "flux",
      "kling",
      "sora",
      "veo",
      "wan",
      "stable",
      "diffusion",
      "video",
      "image",
      "2d",
      "3d",
      "potret",
      "seni",
      "furry",
      "anime",
      "pixar",
      "realistis",
      "realitas",
      "zimage",
      "imagine",
      "kling_video",
      "seaart",
      "wai-ani",
      "banana",
      "infinity",
      "realism",
      "epik",
    ];

    const models = data.data
      .filter((model: any) => {
        const id = model.id.toLowerCase();
        return !excludeKeywords.some((kw) => id.includes(kw));
      })
      .map((model: any) => model.id)
      .sort((a: string, b: string) => a.localeCompare(b));

    return json({ models });
  } catch (error: any) {
    console.error("Error fetching models:", error);
    return json({ error: error.message }, { status: 500 });
  }
}
