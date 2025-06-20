import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from "@google/generative-ai";

const mcpTools = [
  {
    name: "find_relevant_datasets",
    description: "Intelligently finds and ranks datasets from Toronto's Open Data portal based on a query. Use this to discover relevant datasets for a user's topic of interest.",
    parameters: {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        query: { type: FunctionDeclarationSchemaType.STRING, description: "The search query (e.g., 'traffic accidents', 'housing development')." },
        maxResults: { type: FunctionDeclarationSchemaType.NUMBER, description: "Maximum number of datasets to return." },
      },
      required: ["query"],
    },
  },
  {
    name: "analyze_dataset_updates",
    description: "Analyzes the update frequency of datasets. Use this to determine how current or stale a dataset is.",
    parameters: {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        query: { type: FunctionDeclarationSchemaType.STRING, description: "A keyword query to find datasets to analyze." },
        packageIds: { 
          type: FunctionDeclarationSchemaType.ARRAY, 
          items: { type: FunctionDeclarationSchemaType.STRING },
          description: "An array of specific dataset IDs to analyze."
        },
      },
      required: [], // User can provide query OR packageIds
    },
  },
  {
    name: "analyze_dataset_structure",
    description: "Provides a deep-dive into a dataset's structure, including field definitions, data types, and record counts.",
    parameters: {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        packageId: { type: FunctionDeclarationSchemaType.STRING, description: "The unique identifier of the dataset (e.g., 'building-permits')." },
        includeDataPreview: { type: FunctionDeclarationSchemaType.BOOLEAN, description: "Whether to include a small preview of the data records." },
        previewLimit: { type: FunctionDeclarationSchemaType.NUMBER, description: "The number of records to return in the preview." },
      },
      required: ["packageId"],
    },
  },
  {
    name: "get_dataset_insights",
    description: "Provides a comprehensive analysis of datasets matching a query, combining relevance ranking, update frequency, and data structure.",
    parameters: {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {
        query: { type: FunctionDeclarationSchemaType.STRING, description: "The search query for which to generate insights." },
        maxDatasets: { type: FunctionDeclarationSchemaType.NUMBER, description: "The maximum number of datasets to include in the analysis." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_data_categories",
    description: "Retrieves all available data categories, organizations, and topic groups from the Toronto Open Data portal.",
    parameters: {
      type: FunctionDeclarationSchemaType.OBJECT,
      properties: {},
      required: [],
    },
  }
];

const MCP_SERVER_URL = "https://toronto-mcp.s-a62.workers.dev/mcp";

async function callMcpTool(tool, parameters) {
  try {
    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, parameters }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MCP tool call failed with status ${response.status}: ${errorText}`);
      return { error: `Tool call failed: ${errorText}` };
    }
    return await response.json();
  } catch (error) {
    console.error("Error calling MCP tool:", error);
    return { error: "Failed to execute tool." };
  }
}

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
      tools: [{ functionDeclarations: mcpTools }],
    });

    const chat = model.startChat();
    
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Start a non-streaming call to check for tool use first.
    const result = await chat.sendMessage(prompt);
    const response = result.response;
    const toolCalls = response.functionCalls();

    if (!toolCalls || toolCalls.length === 0) {
      // No tool call, but the user expects a stream.
      // We already have the full text, so we'll send it in a single chunk.
      (async () => {
        try {
          const responseText = response.text();
          if (responseText) {
            await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk: responseText })}\n\n`));
          }
        } catch (error) {
          console.error("Gemini stream processing error (no tool):", error);
          await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Failed to generate response", details: error.message })}\n\n`));
        } finally {
          await writer.close();
        }
      })();
    } else {
      // Tool call was requested
      (async () => {
        try {
          // We only handle the first tool call for simplicity
          const call = toolCalls[0];
          await writer.write(encoder.encode(`data: ${JSON.stringify({ isMcp: true, tool_call: { name: call.name, args: call.args } })}\n\n`));
          const apiResponse = await callMcpTool(call.name, call.args);

          // Now, get the streaming response from the model after providing the tool's result
          const streamResult = await chat.sendMessageStream([
            { functionResponse: { name: call.name, response: { content: JSON.stringify(apiResponse) } } }
          ]);

          for await (const chunk of streamResult.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              await writer.write(encoder.encode(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`));
            }
          }
        } catch (error) {
          console.error("Gemini stream processing error (with tool):", error);
          await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Failed to generate response", details: error.message })}\n\n`));
        } finally {
          await writer.close();
        }
      })();
    }
    
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