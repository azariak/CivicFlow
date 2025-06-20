import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from "@google/generative-ai";

const MCP_SERVER_URL = "https://toronto-mcp.s-a62.workers.dev/mcp";

const tools = {
  functionDeclarations: [
    {
      name: "find_relevant_datasets",
      description: "Intelligently find and rank datasets from Toronto's Open Data portal using relevance scoring.",
      parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
          query: { type: FunctionDeclarationSchemaType.STRING, description: "The search query to find relevant datasets." },
          maxResults: { type: FunctionDeclarationSchemaType.NUMBER, description: "The maximum number of results to return. Defaults to 5." },
          includeRelevanceScore: { type: FunctionDeclarationSchemaType.BOOLEAN, description: "Whether to include the relevance score in the result. Defaults to true." }
        },
        required: ["query"]
      }
    },
    {
      name: "get_dataset_insights",
      description: "Get comprehensive analysis of a dataset, including relevance, update frequency, and data structure.",
      parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: {
          query: { type: FunctionDeclarationSchemaType.STRING, description: "The query to find the dataset." },
          maxDatasets: { type: FunctionDeclarationSchemaType.NUMBER, description: "The maximum number of datasets to analyze. Defaults to 3." },
          includeUpdateFrequency: { type: FunctionDeclarationSchemaType.BOOLEAN, description: "Whether to include update frequency analysis. Defaults to true." },
          includeDataStructure: { type: FunctionDeclarationSchemaType.BOOLEAN, description: "Whether to include data structure analysis. Defaults to true." }
        },
        required: ["query"]
      }
    }
  ]
};

async function callMcpServer(functionCall) {
    const { name, args } = functionCall;
    const mcpResponse = await fetch(MCP_SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: name,
            params: args,
            id: 1,
        }),
    });

    if (!mcpResponse.ok) {
        const errorText = await mcpResponse.text();
        throw new Error(`MCP server request failed: ${mcpResponse.status} ${errorText}`);
    }
    return mcpResponse.json();
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const { prompt, systemInstructions, apiKey: localApiKey, history = [] } = await request.json();
    const apiKey = localApiKey || env.GEMINI_API_KEY;

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
      tools: [tools],
    });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const writeToStream = (data) => {
        return writer.write(encoder.encode(data));
    };

    (async () => {
        try {
            const chat = model.startChat({ history });
            const result = await chat.sendMessage(prompt);
            const response = result.response;

            if (response.functionCalls && response.functionCalls.length > 0) {
                await writeToStream(`event: mcp_start\ndata: {}\n\n`);
                const functionCall = response.functionCalls[0];
                const mcpResult = await callMcpServer(functionCall);

                const toolResponseResult = await chat.sendMessageStream([
                    {
                        functionResponse: {
                            name: functionCall.name,
                            response: mcpResult.result,
                        },
                    },
                ]);
                
                for await (const chunk of toolResponseResult.stream) {
                    const chunkText = chunk.text();
                    if (chunkText) {
                        await writeToStream(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
                    }
                }
            } else {
                const text = response.text();
                const chunks = text.match(/.{1,25}/g) || [text];
                for (const chunk of chunks) {
                    await writeToStream(`data: ${JSON.stringify({ chunk })}\n\n`);
                    await new Promise(res => setTimeout(res, 20)); // simulate streaming
                }
            }
        } catch (error) {
            console.error("Gemini stream processing error:", error);
            await writeToStream(`event: error\ndata: ${JSON.stringify({ error: "Failed to generate response", details: error.message })}\n\n`);
        } finally {
            await writer.close();
        }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text-event-stream",
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
