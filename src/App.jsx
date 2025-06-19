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
                  if (json.chunk) {
                    updateLastMessage(json.chunk);
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
            model: "gemini-2.0-flash-exp",
            systemInstruction: systemInstructions 
          });

          const stream = await model.generateContentStream({
            contents: [{ role: "user", parts: [{ text }] }],
            generationConfig: { maxOutputTokens: 1000 },
          });

          for await (const chunk of stream.stream) {
            const chunkText = chunk.text();
            if (chunkText) {
              updateLastMessage(chunkText);
            }
          }
          streamEnded = true;
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
          {isDarkMode ? '☀️' : '🌙'}
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
        </a> <a href="https://lu.ma/apcio9op" target="_blank" rel="noopener noreferrer" className="link"> @ PROGRAM: Toronto</a>
      </div>
    </div>
  );
};

export default App;