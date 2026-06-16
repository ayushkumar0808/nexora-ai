import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { message, history, image } = await req.json();

    const contents: any[] = [];

    if (history && history.length > 0) {
      for (const msg of history) {
        if (msg.content === "Hi buddy!👋 I'm Nexora. How can I help you today?") continue;

        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Add current user message
    const currentParts: any[] = [];

    if (message) {
      currentParts.push({ text: message });
    }

    if (image) {
      currentParts.push({
        inlineData: {
          mimeType: image.match(/^data:(.*);base64,/)?.[1] || "image/png",
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

    const result = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
    });

    return Response.json({
      reply: result.text,
    });
  } catch (error) {
    console.error("API ERROR:", error); 
    return Response.json(
      { reply: "Sorry buddy, Nexora is unavailable right now." },
      { status: 500 }
    );
  }
}