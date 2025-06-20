import React from "react";
// import ReactMarkdown from "react-markdown";

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
          }`}
          style={{ display: "inline-block" }}
        >
          {/* <ReactMarkdown
            className="markdown-content"
            components={{
              p: ({ children }) => <span style={markdownStyles}>{children}</span>,
              a: ({ children, href }) => (
                <a href={href} style={linkStyles}>
                  {children}
                </a>
              ),
            }}
          >
            {msg.content}
          </ReactMarkdown> */}
          {/* <span>{msg.content}</span> */}
          <span dangerouslySetInnerHTML={{ __html: msg.content }} />

        </div>
      ))}
    </div>
  );
};

export default MessageList;