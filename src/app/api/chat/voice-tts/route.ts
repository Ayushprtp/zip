import { NextRequest } from "next/server";
import { getSession } from "auth/server";

const PICCY_API_URL =
  "https://www.sparklingapps.com/piccybotapi/index.php/speech";

const PICCY_VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { voice = "alloy", text } = await req.json();

    if (!text || text.trim() === "") {
      return Response.json(
        { error: { message: "Text parameter is required" } },
        { status: 400 },
      );
    }

    const cleanVoice = voice.toLowerCase().trim();
    const cleanText = text.trim();

    if (!PICCY_VOICES.includes(cleanVoice)) {
      return Response.json(
        {
          error: {
            message: `Invalid voice. Available: ${PICCY_VOICES.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    if (cleanText.length > 5000) {
      return Response.json(
        { error: { message: "Text cannot exceed 5000 characters" } },
        { status: 400 },
      );
    }

    const instructedText = `Read only this text word by word, do not add anything else: ${cleanText}`;

    const payload = {
      extracted_content: instructedText,
      voice: cleanVoice,
      exp: true,
      mode: "standard",
      purchase_token: "",
      sub: true,
      piccy_valid: "",
    };

    const response = await fetch(PICCY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "PiccyBot/1.76",
        Accept: "*/*",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return Response.json(
        {
          error: {
            message: `TTS API returned status ${response.status}`,
          },
        },
        { status: 500 },
      );
    }

    const audioBuffer = await response.arrayBuffer();

    if (audioBuffer.byteLength === 0) {
      return Response.json(
        { error: { message: "Empty response from TTS API" } },
        { status: 500 },
      );
    }

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="tts_${cleanVoice}.mp3"`,
      },
    });
  } catch (error: any) {
    console.error("Voice TTS error:", error);
    return Response.json(
      { error: { message: error.message || "TTS generation failed" } },
      { status: 500 },
    );
  }
}
