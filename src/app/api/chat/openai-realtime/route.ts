import { NextRequest } from "next/server";
import { getSession } from "auth/server";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { model = "gpt-4o-realtime-preview", voice = "alloy" } =
      await req.json();

    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          voice,
          modalities: ["audio", "text"],
          instructions: "You are a helpful assistant.",
        }),
      },
    );

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
