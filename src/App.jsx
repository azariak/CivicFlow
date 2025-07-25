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
    { role: "assistant", content: "Hi there! Welcome to CivicFlowTO!" },
    {
      role: "assistant",
      content:
        "What would you like to know about Toronto and its [open data](https://www.toronto.ca/city-government/data-research-maps/open-data/)?",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState(
    questionsAndAnswers.suggestedQuestions
  );

  const systemInstructions = questionsAndAnswers.systemInstructions;
  const messagesEndRef = useRef(null);

  // Reset function to reset the chat to initial state
  const resetChat = () => {
    setMessages([
      { role: "assistant", content: "Hi there! Welcome to CivicFlowTO!" },
      {
        role: "assistant",
        content:
          "What would you like to know about Toronto and its [open data](https://www.toronto.ca/city-government/data-research-maps/open-data/)?",
      },
    ]);
    setInputMessage("");
    setIsLoading(false);
    setSuggestedQuestions(
      shuffleArray([...questionsAndAnswers.suggestedQuestions])
    );
  };

  useEffect(() => {
    setSuggestedQuestions((prevQuestions) => shuffleArray([...prevQuestions]));
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text = inputMessage, retryCount = 0) => {
    console.log("=== sendMessage called with:", text);

    if (text.trim() === "" || isLoading) return;

    const userMessage = { role: "user", content: text };
    const assistantPlaceholder = { role: "assistant", content: "" };

    // Add user message and placeholder for assistant response
    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setInputMessage("");
    setIsLoading(true);

    console.log("=== Messages updated, starting API call");

    // Helper function to update the last message (assistant's response)
    const updateLastMessage = (chunk) => {
      console.log("=== updateLastMessage called with chunk:", chunk);
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === prev.length - 1
            ? { ...msg, content: msg.content + chunk }
            : msg
        )
      );
    };

    // Helper function to handle API errors
    const handleApiError = async (errorMessage) => {
      console.error("API error:", errorMessage);
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
        console.log("Sending request to /api/generate:", {
          prompt: text,
          systemInstructions,
          history: messages,
        });

        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: text,
            systemInstructions,
            history: messages,
          }),
        });

        console.log("Response status:", response.status);
        console.log(
          "Response headers:",
          Object.fromEntries(response.headers.entries())
        );

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
        let totalChunks = 0;
        let totalContent = "";

        console.log("Starting to read stream...");

        while (reading) {
          console.log("About to read from stream...");
          const { value, done } = await reader.read();
          console.log(
            "Read result - done:",
            done,
            "value length:",
            value?.length
          );

          if (done) {
            streamEnded = true;
            reading = false;
            console.log("Stream ended. Total chunks received:", totalChunks);
            console.log("Total content length:", totalContent.length);
            break;
          }

          console.log("Raw stream value:", value);

          // Process SSE data format: data: {...}\n\n
          const lines = value.split("\n");
          for (const line of lines) {
            if (line.startsWith("data:")) {
              try {
                const jsonData = line.substring(5).trim();
                console.log("Processing SSE data:", jsonData);

                const json = JSON.parse(jsonData);
                console.log("Parsed JSON:", json);

                if (json.chunk) {
                  totalChunks++;
                  totalContent += json.chunk;
                  console.log(`Chunk ${totalChunks}:`, json.chunk);
                  updateLastMessage(json.chunk);
                } else if (json.error) {
                  console.error("SSE error received:", json);
                  throw new Error(
                    `Server SSE error: ${json.details || json.error}`
                  );
                }
              } catch (e) {
                console.error("Error parsing SSE line:", line, e);
                // If it's not valid JSON, treat the entire line as plain text response
                const plainText = line.substring(5).trim();
                if (plainText) {
                  console.log("Treating as plain text:", plainText);
                  updateLastMessage(plainText);
                }
              }
            } else if (line.startsWith("event: error")) {
              console.error("Error event received:", line);
              // Handle explicit error events if the backend sends them
              // The data line following this should contain the error details
            } else if (line.trim() && !line.startsWith("data:")) {
              // Handle plain text responses that aren't in SSE format
              console.log("Plain text response:", line);
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
          console.log(
            `Worker restarted - retrying request (attempt ${
              retryCount + 1
            }/3)...`
          );
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
    <div className={`container ${isDarkMode ? "dark" : "light"}`}>
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

      <HelpPopup isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      <div className="content">
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
