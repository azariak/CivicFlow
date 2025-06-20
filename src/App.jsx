import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import SettingsModal from './SettingsModal';
import MessageList from './MessageList';
import InputArea from './InputArea';
import SuggestedQuestions from './SuggestedQuestions';
import { HelpPopup } from './helpPopup';
import './index.css';
import questionsAndAnswers from './data/questionsAndAnswers.json';

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const mcpTools = [
  {
    name: "find_relevant_datasets",
    description: "Intelligently finds and ranks datasets from Toronto's Open Data portal based on a query. Use this to discover relevant datasets for a user's topic of interest.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "The search query (e.g., 'traffic accidents', 'housing development')." },
        maxResults: { type: "NUMBER", description: "Maximum number of datasets to return." },
      },
      required: ["query"],
    },
  },
  {
    name: "analyze_dataset_updates",
    description: "Analyzes the update frequency of datasets. Use this to determine how current or stale a dataset is.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "A keyword query to find datasets to analyze." },
        packageIds: { 
          type: "ARRAY", 
          items: { type: "STRING" },
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
      type: "OBJECT",
      properties: {
        packageId: { type: "STRING", description: "The unique identifier of the dataset (e.g., 'building-permits')." },
        includeDataPreview: { type: "BOOLEAN", description: "Whether to include a small preview of the data records." },
        previewLimit: { type: "NUMBER", description: "The number of records to return in the preview." },
      },
      required: ["packageId"],
    },
  },
  {
    name: "get_dataset_insights",
    description: "Provides a comprehensive analysis of datasets matching a query, combining relevance ranking, update frequency, and data structure.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: { type: "STRING", description: "The search query for which to generate insights." },
        maxDatasets: { type: "NUMBER", description: "The maximum number of datasets to include in the analysis." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_data_categories",
    description: "Retrieves all available data categories, organizations, and topic groups from the Toronto Open Data portal.",
    parameters: {
      type: "OBJECT",
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

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi there! Welcome to CivicFlowTO!" },
    { role: 'assistant', content: "What would you like to know about Toronto and its <a href='https://www.toronto.ca/city-government/data-research-maps/open-data/' target='_blank' rel='noopener noreferrer' style='color: white; text-decoration: underline;'>open data</a>?" },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState(
    questionsAndAnswers.suggestedQuestions
  );

  const predefinedAnswers = questionsAndAnswers.predefinedAnswers;
  const systemInstructions = questionsAndAnswers.systemInstructions;
  const messagesEndRef = useRef(null);

  // Reset function to reset the chat to initial state
  const resetChat = () => {
    setMessages([
      { role: 'assistant', content: "Hi there! Welcome to CivicFlowTO!" },
      { role: 'assistant', content: "What would you like to know about Toronto and its <a href='https://www.toronto.ca/city-government/data-research-maps/open-data/' target='_blank' rel='noopener noreferrer' style='color: white; text-decoration: underline;'>open data</a>?" },
    ]);
    setInputMessage('');
    setIsLoading(false);
    setSuggestedQuestions((prevQuestions) => shuffleArray([...questionsAndAnswers.suggestedQuestions]));
  };

  useEffect(() => {
    setSuggestedQuestions((prevQuestions) => shuffleArray([...prevQuestions]));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text = inputMessage) => {
    if (text.trim() === '' || isLoading) return;

    const userMessage = { role: 'user', content: text };
    const assistantPlaceholder = { role: 'assistant', content: '' };

    // Add user message and placeholder for assistant response
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInputMessage('');
    setIsLoading(true);

    const simulateThinking = () => new Promise(resolve => setTimeout(resolve, 200));

    // Handle predefined answers
    if (predefinedAnswers[text]) {
      // Keep the initial thinking delay, but stream the answer afterwards
      await simulateThinking(); 
      const answers = predefinedAnswers[text];
      const randomAnswer = answers[Math.floor(Math.random() * answers.length)];
      
      // Simulate streaming for predefined answers by batching characters
      let currentStreamedLength = 0;
      const batchSize = 15; // Number of characters to add per interval
      const intervalDelay = 2; // Milliseconds between batches

      const streamInterval = setInterval(() => {
        const nextChunkEnd = Math.min(currentStreamedLength + batchSize, randomAnswer.length);
        const chunkToAdd = randomAnswer.substring(currentStreamedLength, nextChunkEnd);

        if (chunkToAdd.length > 0) {
          setMessages((prev) => prev.map((msg, index) =>
            index === prev.length - 1
              ? { ...msg, content: msg.content + chunkToAdd } // Append the chunk
              : msg
          ));
          currentStreamedLength = nextChunkEnd;
        }

        if (currentStreamedLength >= randomAnswer.length) {
          clearInterval(streamInterval);
          setIsLoading(false); // Set loading false only when streaming is complete
        }
      }, intervalDelay); // Use a small delay for batching

      return; // Return early as we handled the predefined answer
    }

    // Helper function to update the last message (assistant's response)
    const updateLastMessage = (chunk) => {
      setMessages((prev) => prev.map((msg, index) => 
        index === prev.length - 1 ? { ...msg, content: msg.content + chunk } : msg
      ));
    };

    const setLastMessageProperty = (property, value) => {
      setMessages(prev => prev.map((msg, index) => 
        index === prev.length - 1 ? { ...msg, [property]: value } : msg
      ));
    };

    const replaceLastMessageContent = (content) => {
      setMessages(prev => prev.map((msg, index) => 
        index === prev.length - 1 ? { ...msg, content } : msg
      ));
    };

    // Helper function to handle API errors
    const handleApiError = async (errorMessage) => {
      console.error('API error:', errorMessage);
      await simulateThinking(); // Keep thinking simulation for errors
      setMessages((prev) => prev.map((msg, index) => 
        index === prev.length - 1 
          ? { ...msg, content: 'An error occurred. Please try again later.' } 
          : msg
      ));
      setIsLoading(false);
    };

    try {
      const localApiKey = localStorage.getItem('GEMINI_API_KEY');
      let streamEnded = false;

      if (!localApiKey) {
        // --- Server API Streaming --- 
        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: text, systemInstructions }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Server API failed: ${response.status} ${errorData.error || ''}`);
          }
          if (!response.body) {
            throw new Error('Response body is null');
          }

          const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
          
          while (true) {
            const { value, done } = await reader.read();
            if (done) {
              streamEnded = true;
              break;
            }
            // Process SSE data format: data: {...}\n\n
            const lines = value.split('\n');
            for (const line of lines) {
              if (line.startsWith('data:')) {
                try {
                  const json = JSON.parse(line.substring(5).trim());
                  if (json.isMcp) {
                    setLastMessageProperty('isMcp', true);
                  }
                  if (json.tool_call) {
                    const toolName = json.tool_call.name;
                    const toolArgs = JSON.stringify(json.tool_call.args);
                    replaceLastMessageContent(`*Using tool: ${toolName}(${toolArgs})...*`);
                  }
                  if (json.chunk) {
                    // When the first real chunk arrives, it might overwrite the "Using tool" message.
                    // Let's check if the current content is the "using tool" message.
                    let isFirstChunk = false;
                    setMessages(prev => {
                      const lastMsg = prev[prev.length - 1];
                      if (lastMsg.content.startsWith('*Using tool:')) {
                        isFirstChunk = true;
                      }
                      return prev;
                    });

                    if(isFirstChunk) {
                      replaceLastMessageContent(json.chunk);
                    } else {
                      updateLastMessage(json.chunk);
                    }
                  } else if (json.error) {
                     throw new Error(`Server SSE error: ${json.details || json.error}`);
                  }
                } catch (e) {
                  console.error("Error parsing SSE line:", line, e);
                }
              } else if (line.startsWith('event: error')) {
                 // Handle explicit error events if the backend sends them
                 // The data line following this should contain the error details
              }
            }
          }
        } catch (error) {
          console.error('Server API stream error:', error);
          // If server fails, don't immediately try local (unless specifically requested)
          // Just show error
          await handleApiError(error.message || 'Failed to fetch streaming response');
          return; // Stop execution
        }
      } else {
        // --- Local API Key Streaming --- 
        try {
          const genAI = new GoogleGenerativeAI(localApiKey);
          const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash-latest",
            systemInstruction: systemInstructions,
            tools: [{ functionDeclarations: mcpTools }],
          });

          const chat = model.startChat();
          const result = await chat.sendMessage(text);
          const response = result.response;
          const toolCalls = response.functionCalls();

          if (!toolCalls || toolCalls.length === 0) {
            // No tool call, just stream the response text.
            await new Promise(resolve => {
              const responseText = response.text();
              let currentStreamedLength = 0;
              const batchSize = 15;
              const intervalDelay = 2;
              const streamInterval = setInterval(() => {
                const nextChunkEnd = Math.min(currentStreamedLength + batchSize, responseText.length);
                const chunkToAdd = responseText.substring(currentStreamedLength, nextChunkEnd);
                if (chunkToAdd.length > 0) {
                  updateLastMessage(chunkToAdd);
                  currentStreamedLength = nextChunkEnd;
                }
                if (currentStreamedLength >= responseText.length) {
                  clearInterval(streamInterval);
                  streamEnded = true;
                  resolve();
                }
              }, intervalDelay);
            });
          } else {
            // Tool call was requested
            setLastMessageProperty('isMcp', true);
            const call = toolCalls[0];
            const toolName = call.name;
            const toolArgs = JSON.stringify(call.args);
            replaceLastMessageContent(`*Using tool: ${toolName}(${toolArgs})...*`);

            const apiResponse = await callMcpTool(call.name, call.args);

            const streamResult = await chat.sendMessageStream([
              { functionResponse: { name: call.name, response: { content: JSON.stringify(apiResponse) } } }
            ]);
            
            let isFirstChunk = true;
            for await (const chunk of streamResult.stream) {
              const chunkText = chunk.text();
              if (chunkText) {
                if (isFirstChunk) {
                  replaceLastMessageContent(chunkText);
                  isFirstChunk = false;
                } else {
                  updateLastMessage(chunkText);
                }
              }
            }
            streamEnded = true;
          }

        } catch (error) {
          console.error('Local API key stream error:', error);
          if (error.message && error.message.includes('API key not valid')) {
            localStorage.removeItem('GEMINI_API_KEY');
            // Optionally: You could trigger the server API call here as a fallback
            // For now, just show the error
            await handleApiError('Local API key is invalid. Please check settings or remove it.');
          } else {
            await handleApiError(error.message || 'Failed to generate response with local key');
          }
          return; // Stop execution
        }
      }

      // If we reach here and the stream hasn't ended (e.g., unexpected break), treat as error
      if (!streamEnded) {
         await handleApiError('Stream ended unexpectedly.');
      }

    } catch (error) {
      // Catch-all for unexpected errors during setup or pre-API call logic
      await handleApiError(error.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };  

  const handleQuestionClick = (question) => {
    sendMessage(question);
  };

  return (
    <div className={`container ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="header-controls">
        <button
          className="control-button"
          onClick={() => setIsHelpOpen(true)}
          aria-label="Open Help"
        >
          <img src="/help.svg" alt="Help" width={20} height={20} />
        </button>
        <button
          className="control-button"
          onClick={() => window.open('https://github.com/azariak/CivicFlow', '_blank')}
          aria-label="Open GitHub"
        >
          <img src="/github-mark-white.png" alt="GitHub" width={20} height={20} />
        </button>
        <button
          className="control-button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? '☀' : <img src="/Moon.svg" alt="Moon" width={35} height={35} />}
        </button>
        <button
          className="control-button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Open Settings"
        >
          <img src="/Settings.svg" alt="Settings" width={20} height={20} />
        </button>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <HelpPopup
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <div className="content">
        <div className="skyline-container">
          <img src="/TorontoSkyline.svg" alt="Toronto Skyline" className="skyline-image" />
        </div>
        
        <header className="header">
          <div className="header-content">
            <h1 className="header-title" style={{ color: 'var(--text-blue)' }}>Ask The City 🦝</h1>
            <button
              className="reset-button"
              onClick={resetChat}
              aria-label="Reset chat"
              title="Reset chat"
            >
              ↻
            </button>
          </div>
        </header>

        <main className="chat-container">
          <MessageList messages={messages} />
          <div ref={messagesEndRef} />
        </main>

        <SuggestedQuestions
          suggestedQuestions={suggestedQuestions}
          handleQuestionClick={handleQuestionClick}
        />

        <InputArea
          inputMessage={inputMessage}
          setInputMessage={setInputMessage}
          sendMessage={sendMessage}
          isLoading={isLoading}
        />

        <div className="ai-disclaimer">
          AI responses are not perfect. Sometimes it makes stuff up.
        </div>
      </div>

      <div className="footer">
        Designed by{' '}
        <a
          href="https://github.com/azariak"
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          Azaria Kelman
        </a> @ <a href="https://lu.ma/apcio9op" target="_blank" rel="noopener noreferrer" className="link"> PROGRAM: Toronto</a>
      </div>
    </div>
  );
};

export default App;