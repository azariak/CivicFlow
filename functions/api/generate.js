import { GoogleGenerativeAI } from "@google/generative-ai";

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { prompt, systemInstructions } = await request.json();
    const apiKey = env.GEMINI_API_KEY;

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!systemInstructions) {
      return new Response(JSON.stringify({ error: "System instructions are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error: Missing API key" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      systemInstruction: systemInstructions,
    });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const stream = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    (async () => {
      try {
        for await (const chunk of stream.stream) {
          const chunkText = chunk.text();
          if (chunkText) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`));
          }
        }
      } catch (error) {
        console.error("Gemini stream processing error:", error);
        await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Failed to generate response", details: error.message })}\n\n`));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error) {
    console.error("Detailed API error:", error);
    return new Response(JSON.stringify({
        error: "Failed to generate streaming response",
        details: error.message,
    }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
    });
  }
} 