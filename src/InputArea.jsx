import React from 'react';

const InputArea = ({ inputMessage, setInputMessage, sendMessage, isLoading }) => {
  return (
    <footer className="input-area">
      <input
        type="text"
        value={inputMessage}
        onChange={(e) => setInputMessage(e.target.value)}
        className="input"
        placeholder="Ask me anything..."
        onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        disabled={isLoading}
      />
      <button
        className={`send-button ${isLoading ? 'loading' : ''}`}
        onClick={() => sendMessage()}
        aria-label="Send message"
        disabled={isLoading}
      >
        {isLoading ? 'Thinking...' : 'Send'}
      </button>
    </footer>
  );
};

export default InputArea;