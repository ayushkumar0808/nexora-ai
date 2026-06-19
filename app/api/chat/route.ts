import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

async function generateWithRetry(messages: any[]) {
  let lastError;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await groq.chat.completions.create({
        model: "llama-3.1-8b-instant", 
        messages,
        max_tokens: 1000,
      });
    } catch (error: any) {
      lastError = error;
      console.error(`Attempt ${attempt + 1} failed:`, error?.message || error);

      const errorText = JSON.stringify(error);
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
    const { message, history } = await req.json(); // image hata diya

    const messages: any[] = [
      {
        role: "system",
        content: "You are Nexora, a helpful AI assistant.",
      },
    ];

    if (history && history.length > 0) {
      for (const msg of history) {
        if (
          msg.content ===
          "Hi buddy!👋 I'm Nexora. How can I help you today?"
        ) {
          continue;
        }
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    if (message) {
      messages.push({
        role: "user",
        content: message,
      });
    }

    const result = await generateWithRetry(messages);

    return Response.json({
      reply: result.choices[0]?.message?.content || "No response",
    });
  } catch (error: any) {
    console.error("API ERROR:", error);
    return Response.json(
      {
        reply: "Nexora is currently experiencing high traffic. Please wait a few seconds and try again.",
      },
      { status: 500 }
    );
  }
}