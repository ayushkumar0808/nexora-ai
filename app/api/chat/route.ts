import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { message, image } = await req.json();

    const contents: any[] = [];

    if (message) {
      contents.push({
        role: "user",
        parts: [{ text: message }],
      });
    }

    if (image) {
      contents.push({
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType:
                image.match(/^data:(.*);base64,/)?.[1] || "image/png",
              data: image.split(",")[1],
            },
          },
        ],
      });
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
    });

    return Response.json({
      reply: result.text,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        reply: "Sorry buddy, Gemini is unavailable right now.",
      },
      { status: 500 }
    );
  }
}