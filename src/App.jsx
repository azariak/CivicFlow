import React, { useEffect, useRef, useState } from "react";
import InputArea from "./InputArea";
import MessageList from "./MessageList";
import SettingsModal from "./SettingsModal";
import SuggestedQuestions from "./SuggestedQuestions";
import questionsAndAnswers from "./data/questionsAndAnswers.json";
import { HelpPopup } from "./helpPopup";
import "./index.css";

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const App = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi there! Welcome to DataFlowTO!", metadata: null },
    {
      role: "assistant",
      content:
        "What would you like to know about Toronto and its [open data](https://www.toronto.ca/city-government/data-research-maps/open-data/)?",
      metadata: null,
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingStarted, setStreamingStarted] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState(
    questionsAndAnswers.suggestedQuestions
  );
  
  // Resize functionality state
  const [containerDimensions, setContainerDimensions] = useState({
    width: 830,
    height: 675
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const systemInstructions = questionsAndAnswers.systemInstructions;
  const messagesEndRef = useRef(null);

  // Desktop detection
  useEffect(() => {
    const checkIsDesktop = () => {
      const hasHover = window.matchMedia('(hover: hover)').matches;
      const isLargeScreen = window.innerWidth > 768;
      setIsDesktop(hasHover && isLargeScreen);
    };
    
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  // Resize functionality
  const handleResizeStart = (e) => {
    if (!isDesktop) return;
    e.preventDefault();
    setIsResizing(true);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = containerDimensions.width;
    const startHeight = containerDimensions.height;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(400, Math.min(1200, startWidth + (e.clientX - startX)));
      const newHeight = Math.max(500, Math.min(800, startHeight + (e.clientY - startY)));
      
      setContainerDimensions({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const resetContainerSize = () => {
    setContainerDimensions({ width: 830, height: 675 });
  };

  // Reset function to reset the chat to initial state
  const resetChat = () => {
    setMessages([
      { role: "assistant", content: "Hi there! Welcome to DataFlowTO!", metadata: null },
      {
        role: "assistant",
        content:
          "What would you like to know about Toronto and its [open data](https://www.toronto.ca/city-government/data-research-maps/open-data/)?",
        metadata: null,
      },
    ]);
    setInputMessage("");
    setIsLoading(false);
    setStreamingStarted(false);
    setSuggestedQuestions(
      shuffleArray([...questionsAndAnswers.suggestedQuestions])
    );
  };

  useEffect(() => {
    setSuggestedQuestions((prevQuestions) => shuffleArray([...prevQuestions]));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text = inputMessage, retryCount = 0) => {
    if (text.trim() === "" || isLoading) return;

    const userMessage = { role: "user", content: text, metadata: null };
    const assistantPlaceholder = { role: "assistant", content: "", metadata: null };

    // Add user message and placeholder for assistant response
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInputMessage("");
    setIsLoading(true);
    setStreamingStarted(false);

    // Helper function to update the last message (assistant's response)
    const updateLastMessage = (chunk, metadata = null) => {
      // Always mark streaming as started when we receive content
      setStreamingStarted(true);
      
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === prev.length - 1
            ? { 
                ...msg, 
                content: msg.content + chunk,
                metadata: metadata ? 
                  (msg.metadata ? mergeMetadata(msg.metadata, metadata) : metadata) : 
                  msg.metadata
              }
            : msg
        )
      );
    };

    // Helper function to merge metadata from multiple chunks
    const mergeMetadata = (existing, incoming) => {
      return {
        functionCalls: [...(existing.functionCalls || []), ...(incoming.functionCalls || [])],
        safetyRatings: incoming.safetyRatings || existing.safetyRatings || [],
        finishReason: incoming.finishReason || existing.finishReason,
        usageMetadata: incoming.usageMetadata || existing.usageMetadata,
        hasNonTextParts: existing.hasNonTextParts || incoming.hasNonTextParts || false
      };
    };

    // Helper function to handle API errors
    const handleApiError = async (errorMessage) => {
      console.error("API error:", errorMessage);
      setStreamingStarted(true); // Hide animation on error too
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === prev.length - 1
            ? { ...msg, content: "An error occurred. Please try again later." }
            : msg
        )
      );
      setIsLoading(false);
    };

    try {
      let streamEnded = false;

      // --- Server API Streaming ---
      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            systemInstructions,
            history: messages,
          }),
        });

        if (!response.ok) {
          let errorData;
          try {
            errorData = await response.json();
          } catch (jsonError) {
            // If response is not JSON, get it as text
            const errorText = await response.text();
            console.error("API response error (plain text):", errorText);
            throw new Error(
              `Server API failed: ${response.status} ${errorText}`
            );
          }
          console.error("API response error:", errorData);
          throw new Error(
            `Server API failed: ${response.status} ${errorData.error || ""}`
          );
        }
        if (!response.body) {
          throw new Error("Response body is null");
        }

        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();

        let reading = true;
        let buffer = "";

        while (reading) {
          const { value, done } = await reader.read();

          if (done) {
            streamEnded = true;
            reading = false;
            // Process any remaining data in the buffer
            if (buffer.trim()) {
              console.warn("Remaining buffer content:", buffer);
              updateLastMessage(buffer); // Treat as plain text
            }
            break;
          }

          buffer += value;

          // Process buffer line by line for SSE data
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.trim() === "") continue;

            if (line.startsWith("data:")) {
              try {
                const jsonData = line.substring(5).trim();

                if (jsonData === "[DONE]") {
                  // Optional: Handle a specific end-of-stream signal if your backend sends one
                  continue;
                }
                
                const json = JSON.parse(jsonData);

                if (json.chunk !== undefined) {
                  updateLastMessage(json.chunk, json.metadata);
                } else if (json.error) {
                  console.error("SSE error received:", json);
                  throw new Error(
                    `Server SSE error: ${json.details || json.error}`
                  );
                }
              } catch (e) {
                console.error("Error parsing SSE line:", line, e);
                // The chunk might be incomplete, so we leave it in the buffer
                // and prepend the line back to the buffer to be processed with the next chunk.
                buffer = line + buffer;
                break; // Exit the while loop to wait for more data from the stream
              }
            } else if (line.startsWith("event: error")) {
              console.error("Error event received:", line);
              // Handle explicit error events if the backend sends them
              // The data line following this should contain the error details
            } else if (line.trim() && !line.startsWith("data:")) {
              // Handle plain text responses that aren't in SSE format
              updateLastMessage(line + "\n");
            }
          }
        }
      } catch (error) {
        console.error("Server API stream error:", error);

        // Special handling for worker restart
        if (
          (error.message.includes("Your worker restarted") ||
            error.message.includes("Unexpected token")) &&
          retryCount < 3
        ) {
          // Retry the request after a short delay
          setTimeout(() => {
            sendMessage(text, retryCount + 1);
          }, 1000);
          return;
        }

        await handleApiError(
          error.message || "Failed to fetch streaming response"
        );
        return; // Stop execution
      }

      // If we reach here and the stream hasn't ended (e.g., unexpected break), treat as error
      if (!streamEnded) {
        console.error("Stream ended unexpectedly");
        await handleApiError("Stream ended unexpectedly.");
      }
    } catch (error) {
      // Catch-all for unexpected errors during setup or pre-API call logic
      console.error("Unexpected error during API call:", error);
      await handleApiError(error.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuestionClick = (question) => {
    console.log("=== handleQuestionClick called with:", question);
    sendMessage(question, 0);
  };

  return (
    <div className={`container ${isDarkMode ? "dark" : "light"} ${isResizing ? "resizing" : ""}`}>
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
          onClick={() =>
            window.open("https://github.com/azariak/CivicFlow", "_blank")
          }
          aria-label="Open GitHub"
        >
          <img
            src="/github-mark-white.png"
            alt="GitHub"
            width={20}
            height={20}
          />
        </button>
        <button
          className="control-button"
          onClick={() => setIsDarkMode(!isDarkMode)}
          aria-label={
            isDarkMode ? "Switch to light mode" : "Switch to dark mode"
          }
        >
          {isDarkMode ? (
            "☀"
          ) : (
            <img src="/Moon.svg" alt="Moon" width={35} height={35} />
          )}
        </button>
        {/* <button
          className="control-button"
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Open Settings"
        >
          <img src="/Settings.svg" alt="Settings" width={20} height={20} />
        </button> */}
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <HelpPopup isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <div 
        className="content" 
        style={{
          width: `${containerDimensions.width}px`,
          height: `${containerDimensions.height}px`,
          maxWidth: 'none'
        }}
      >
        <div className="skyline-container">
          <img
            src="/TorontoSkyline.svg"
            alt="Toronto Skyline"
            className="skyline-image"
          />
        </div>

        <header className="header">
          <div className="header-content">
            <h1 className="header-title" style={{ color: "var(--text-blue)" }}>
              Ask The City 🦝
            </h1>
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
          <MessageList 
            messages={messages} 
            isLoading={isLoading} 
            streamingStarted={streamingStarted} 
          />
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

        {/* <div className="ai-disclaimer">
          AI responses occasionally contain errors. 
        </div> */}
        
        {/* Resize controls - only show on desktop */}
        {isDesktop && (
          <div className="resize-controls">
            {(containerDimensions.width !== 830 || containerDimensions.height !== 675) && (
              <button
                className="size-reset-button"
                onClick={resetContainerSize}
                aria-label="Reset container size"
                title="Reset to default size"
              >
                ↻
              </button>
            )}
            <div 
              className={`resize-handle ${isResizing ? 'resizing' : ''}`}
              onMouseDown={handleResizeStart}
              aria-label="Resize container"
              title="Drag to resize"
            >
              <div className="resize-dots">
                <div className="resize-dot"></div>
                <div className="resize-dot"></div>
                <div className="resize-dot"></div>
                <div className="resize-dot"></div>
                <div className="resize-dot"></div>
                <div className="resize-dot"></div>
                <div className="resize-dot"></div>
                <div className="resize-dot resize-dot-visible"></div>
                <div className="resize-dot resize-dot-visible"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="footer">
        Designed by{" "}
        <a
          href="https://github.com/azariak"
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          Azaria Kelman
        </a>{" "}
        @{" "}
        <a
          href="https://lu.ma/apcio9op"
          target="_blank"
          rel="noopener noreferrer"
          className="link"
        >
          {" "}
          PROGRAM: Toronto
        </a>
      </div>
    </div>
  );
};

export default App;
