import { GoogleGenAI, mcpToTool } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// Constants
const TIMEOUTS = {
  MCP_CONNECTION: 5000,
  GEMINI_API: 30000,
};

const DEFAULT_MCP_SERVER = "https://toronto-mcp.s-a62.workers.dev";

const STREAMING_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

// Patch fetch to remove unsupported options in Cloudflare Workers
const originalFetch = globalThis.fetch;
globalThis.fetch = (url, options = {}) => {
  const { mode: _mode, cache: _cache, ...cleanOptions } = options;
  return originalFetch(url, cleanOptions);
};

// Helper functions
function createJsonErrorResponse(error, status = 500) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createStreamingResponse(content) {
  const stream = new ReadableStream({
    start(controller) {
      const data = `data: ${JSON.stringify({ chunk: content })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
      controller.close();
    },
  });

  return new Response(stream, { headers: STREAMING_HEADERS });
}

function createStreamingGenerator(generator, cleanupFn = null) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          const data = `data: ${JSON.stringify({ chunk })}\n\n`;
          controller.enqueue(new TextEncoder().encode(data));
        }
      } catch (error) {
        const errorData = `data: ${JSON.stringify({ error: error.message })}\n\n`;
        controller.enqueue(new TextEncoder().encode(errorData));
      } finally {
        // Call cleanup function if provided
        if (cleanupFn) {
          try {
            await cleanupFn();
          } catch (cleanupError) {
            console.warn("Error during cleanup:", cleanupError.message);
          }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: STREAMING_HEADERS });
}

function createTimeoutPromise(ms, errorMessage) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(errorMessage)), ms);
  });
}

function formatHistoryForGemini(history) {
  if (!history || !Array.isArray(history)) {
    return [];
  }
  return history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
}

async function connectToMCP(mcpServerUrl) {
  console.log("Connecting to MCP server:", mcpServerUrl);

  const connectMCP = async () => {
    const serverParams = new SSEClientTransport(new URL(`${mcpServerUrl}/sse`));

    const client = new Client({
      name: "civicflow-client",
      version: "1.0.0",
    });

    await client.connect(serverParams);
    console.log("Connected to MCP server");

    return {
      client,
      tool: mcpToTool(client),
    };
  };

  const timeoutPromise = createTimeoutPromise(
    TIMEOUTS.MCP_CONNECTION,
    "MCP connection timeout"
  );

  return Promise.race([connectMCP(), timeoutPromise]);
}

function extractTextFromResponse(response) {
  let finalText = "";

  // Try response.text method first
  try {
    finalText = response.text || "";
    if (finalText) {
      console.log("Extracted text from response.text");
      return finalText;
    }
  } catch (textError) {
    console.log("Error getting text from response.text:", textError.message);
  }

  // Try extracting from candidates
  if (response.candidates?.[0]?.content?.parts) {
    console.log("Extracting text from candidates");
    const parts = response.candidates[0].content.parts;

    for (const part of parts) {
      if (part.text) {
        finalText += part.text;
      }
    }
  }

  return finalText || "Response received but no text content found";
}

async function* generateWithGemini(
  ai,
  prompt,
  systemInstructions,
  mcpTool,
  history
) {
  console.log("Sending request to Gemini with MCP tools for streaming");

  const contents = [...history, { role: "user", parts: [{ text: prompt }] }];

  const generateContentStream = async () => {
    return ai.models.generateContentStream({
      model: "gemini-2.0-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstructions,
        tools: [mcpTool],
      },
    });
  };

  const timeoutPromise = createTimeoutPromise(
    TIMEOUTS.GEMINI_API,
    "Gemini API timeout"
  );

  const responseStream = await Promise.race([generateContentStream(), timeoutPromise]);
  console.log("Received streaming response from Gemini");

  try {
    for await (const chunk of responseStream) {
      // Extract text from the chunk (similar to extractTextFromResponse but for chunks)
      let chunkText = "";
      
      if (chunk.text) {
        chunkText = chunk.text;
      } else if (chunk.candidates?.[0]?.content?.parts) {
        const parts = chunk.candidates[0].content.parts;
        for (const part of parts) {
          if (part.text) {
            chunkText += part.text;
          }
        }
      }

      if (chunkText) {
        yield chunkText;
      }
    }
  } catch (error) {
    console.error("Error during streaming:", error);
    throw error;
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { prompt, systemInstructions, history } = await request.json();
    const apiKey = env.GEMINI_API_KEY;

    // Validate required parameters
    if (!prompt) {
      return createJsonErrorResponse("Prompt is required", 400);
    }

    if (!systemInstructions) {
      return createJsonErrorResponse("System instructions are required", 400);
    }

    if (!apiKey) {
      return createJsonErrorResponse(
        "Server configuration error: Missing API key",
        500
      );
    }

    const formattedHistory = formatHistoryForGemini(history);

    // Initialize MCP client
    let mcpClient = null;
    let mcpTool = null;
    const mcpServerUrl = env.MCP_SERVER_URL || DEFAULT_MCP_SERVER;

    try {
      if (mcpServerUrl) {
        const mcpConnection = await connectToMCP(mcpServerUrl);
        mcpClient = mcpConnection.client;
        mcpTool = mcpConnection.tool;
        console.log("MCP tool created successfully");
      }
    } catch (mcpError) {
      console.error("Failed to connect to MCP server:", mcpError.message);
      mcpClient = null;
      mcpTool = null;
    }

    if (!mcpTool) {
      return createStreamingResponse(
        "MCP server not available. Please try again later."
      );
    }

    // Generate response with Gemini
    const ai = new GoogleGenAI({ apiKey });

    try {
      const streamGenerator = generateWithGemini(
        ai,
        prompt,
        systemInstructions,
        mcpTool,
        formattedHistory
      );

      // Create cleanup function for MCP client
      const cleanupMcp = async () => {
        if (mcpClient) {
          try {
            await mcpClient.close();
          } catch (closeError) {
            console.warn("Error closing MCP client:", closeError.message);
          }
        }
      };

      return createStreamingGenerator(streamGenerator, cleanupMcp);
    } catch (genAIError) {
      console.error("GenAI error with MCP tools:", genAIError.message);
      // Clean up immediately on error
      if (mcpClient) {
        try {
          await mcpClient.close();
        } catch (closeError) {
          console.warn("Error closing MCP client:", closeError.message);
        }
      }
      return createStreamingResponse(
        `Error generating response: ${genAIError.message}`
      );
    }
  } catch (error) {
    console.error("API error:", error.message);
    return new Response(
      JSON.stringify({
        error: "Failed to generate streaming response",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
