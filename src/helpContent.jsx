import React from 'react';

export function HelpContent() { 
  return (    
    <div className="popup-content">
      <div className="popup-section">
        <h4>Key Features</h4>
        <ul>
          <li><strong>Ask Questions:</strong> Type questions about Toronto's open data and city services
            <ul>
              <li><strong>Eg:</strong> What are some datasets related to x? </li>
            </ul>
          </li>
          <li><strong>Suggested Questions:</strong> Click on the suggested questions below the chat to get started quickly</li>
          <li><strong>Real-time Responses:</strong> Get instant, AI-powered answers about Toronto</li>
          <li><strong>Dark Mode:</strong> Toggle between light and dark themes using the moon/sun button</li>
        </ul>
        
        
        <h4>Tips</h4>
        <ul>
          <li>Be specific in your questions for better results</li>
          <li>You can ask about city services, open data, demographics, and more</li>
        </ul>
      </div>
    </div>
  );
}

