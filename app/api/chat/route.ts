import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

async function generateWithRetry(contents: any[]) {
  let lastError;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents,
      });
    } catch (error: any) {
      lastError = error;

      console.error(
        `Attempt ${attempt + 1} failed:`,
        error?.message || error
      );

      const errorText = JSON.stringify(error);

      // Retry only on temporary server issues
      if (
        errorText.includes("503") ||
        errorText.includes("Service Unavailable") ||
        errorText.includes("overloaded")
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2000 * (attempt + 1))
        );
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export async function POST(req: Request) {
  try {
    const { message, history, image } = await req.json();

    const contents: any[] = [];

    // Previous messages
    if (history && history.length > 0) {
      for (const msg of history) {
        if (
          msg.content ===
          "Hi buddy!👋 I'm Nexora. How can I help you today?"
        ) {
          continue;
        }

        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Current message
    const currentParts: any[] = [];

    if (message) {
      currentParts.push({
        text: message,
      });
    }

    // Image support
    if (image) {
      currentParts.push({
        inlineData: {
          mimeType:
            image.match(/^data:(.*);base64,/)?.[1] || "image/png",
          data: image.split(",")[1],
        },
      });
    }

    if (currentParts.length > 0) {
      contents.push({
        role: "user",
        parts: currentParts,
      });
    }

    const result = await generateWithRetry(contents);

    return Response.json({
      reply: result.text,
    });
  } catch (error: any) {
    console.error("API ERROR:", error);

    return Response.json(
      {
        reply:
          " Nexora is currently experiencing high traffic. Please wait a few seconds and try again.",
      },
      { status: 500 }
    );
  }
}