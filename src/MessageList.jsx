import React from "react";
import ReactMarkdown from "react-markdown";

const MessageList = ({ messages }) => {
  const markdownStyles = {
    display: "inline",
    fontSize: "inherit",
    lineHeight: "inherit",
    margin: 0,
    padding: 0,
  };

  const linkStyles = {
    color: "inherit",
    textDecoration: "underline",
  };

  return (
    <div className="message-list">
      {messages.map((msg, index) => (
        <div
          key={index}
          className={`message ${
            msg.role === "assistant" ? "assistant-message" : "user-message"
          } ${msg.usedMcp ? "mcp-message" : ""}`}
          style={{ display: "inline-block" }}
        >
          <div className="markdown-content">
            <ReactMarkdown
              components={{
                p: ({ children }) => (
                  <span style={markdownStyles}>{children}</span>
                ),
                a: ({ children, href }) => (
                  <a href={href} style={linkStyles}>
                    {children}
                  </a>
                ),
              }}
            >
              {msg.content}
            </ReactMarkdown>
          </div>
          {msg.usedMcp && (
            <div className="mcp-indicator">
              Powered by Toronto Open Data
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MessageList;
