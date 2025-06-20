import { GoogleGenAI, mcpToTool } from '@google/genai';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const serverParams = new StdioClientTransport({
  command: "npx",
  args: [
    "@modelcontextprotocol/server-fetch",
    "https://toronto-mcp.s-a62.workers.dev/sse"
  ],
  env: {}
});

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

    const mcpClient = new Client({ name: "toronto-open-data", version: "1.0.0" });
    await mcpClient.connect(serverParams);

    const ai = new GoogleGenAI(apiKey);
    const model = ai.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemInstructions,
    });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    let mcpUsed = false;

    const stream = await model.generateContentStream({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [mcpToTool(mcpClient)],
      generationConfig: {
        maxOutputTokens: 1000,
      },
    });

    (async () => {
      try {
        for await (const chunk of stream.stream) {
          if (chunk.functionCalls && chunk.functionCalls.length > 0) {
            mcpUsed = true;
          }
          const chunkText = chunk.text();
          if (chunkText) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`));
          }
        }
        if (mcpUsed) {
          await writer.write(encoder.encode(`event: mcp_used\ndata: {}\n\n`));
        }
      } catch (error) {
        console.error("Gemini stream processing error:", error);
        await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Failed to generate response", details: error.message })}\n\n`));
      } finally {
        await writer.close();
        await mcpClient.close();
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