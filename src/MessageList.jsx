import React from "react";
import ReactMarkdown from "react-markdown";
import MetadataDropdown from "./MetadataDropdown";

const PoweredByBadge = () => {
  return (
    <div className="powered-by-badge">
      <a 
        href="https://www.toronto.ca/city-government/data-research-maps/open-data/"
        target="_blank"
        rel="noopener noreferrer"
        className="badge-content"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <img src="/TorontoLogo.svg" alt="Toronto Logo" className="badge-logo" width={16} height={16} />
        <span className="badge-text">Powered by City of Toronto Open Data</span>
      </a>
    </div>
  );
};

const MessageList = ({ messages, isLoading }) => {
  const markdownStyles = {
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
          }`}
          style={{ display: "inline-block" }}
        >
          <div className="markdown-content">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p style={markdownStyles}>{children}</p>,
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
          {msg.role === "assistant" && msg.metadata && !(index === messages.length - 1 && isLoading) && <MetadataDropdown metadata={msg.metadata} />}
          {msg.role === "assistant" && msg.showDataBadge && <PoweredByBadge />}
        </div>
      ))}
    </div>
  );
};

export default MessageList;
