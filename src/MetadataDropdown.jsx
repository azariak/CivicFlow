import React, { useState } from 'react';

const MetadataDropdown = ({ metadata }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!metadata || (!metadata.functionCalls?.length && !metadata.hasNonTextParts && !metadata.usageMetadata)) {
    return null;
  }

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  };

  const hasContent = 
    metadata.functionCalls?.length > 0 || 
    metadata.hasNonTextParts || 
    metadata.usageMetadata || 
    metadata.safetyRatings?.length > 0;

  if (!hasContent) return null;

  return (
    <div className="metadata-dropdown">
      <button 
        className="metadata-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle AI metadata"
        title="View AI processing details"
      >
        <span className="metadata-icon">⚙️</span>
        <span className="metadata-label">AI Details</span>
        <span className={`metadata-arrow ${isOpen ? 'open' : ''}`}>▼</span>
      </button>
      
      {isOpen && (
        <div className="metadata-content">
          {metadata.functionCalls?.length > 0 && (
            <div className="metadata-section">
              <h4>Function Calls</h4>
              {metadata.functionCalls.map((call, index) => {
                const callText = JSON.stringify(call, null, 2);
                return (
                  <div key={index} className="function-call">
                    <div className="function-call-header">
                      <strong>{call.name || (call.type === 'response' ? 'Function Response' : 'Function Call')}</strong>
                      <button 
                        className={`copy-btn ${copiedIndex === index ? 'copied' : ''}`}
                        onClick={() => copyToClipboard(callText, index)}
                        title={copiedIndex === index ? "Copied!" : "Copy to clipboard"}
                        aria-label="Copy function call to clipboard"
                      >
                        {copiedIndex === index ? '✓' : '📋'}
                      </button>
                    </div>
                    {call.args && (
                      <pre className="function-args">
                        {JSON.stringify(call.args, null, 2)}
                      </pre>
                    )}
                    {call.response && (
                      <pre className="function-response">
                        Response: {JSON.stringify(call.response, null, 2)}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {metadata.usageMetadata && (
            <div className="metadata-section">
              <h4>Token Usage</h4>
              <div className="usage-stats">
                {metadata.usageMetadata.promptTokenCount && (
                  <div>Prompt: {metadata.usageMetadata.promptTokenCount} tokens</div>
                )}
                {metadata.usageMetadata.candidatesTokenCount && (
                  <div>Response: {metadata.usageMetadata.candidatesTokenCount} tokens</div>
                )}
                {metadata.usageMetadata.totalTokenCount && (
                  <div>Total: {metadata.usageMetadata.totalTokenCount} tokens</div>
                )}
              </div>
            </div>
          )}

          {metadata.safetyRatings?.length > 0 && (
            <div className="metadata-section">
              <h4>Safety Ratings</h4>
              {metadata.safetyRatings.map((rating, index) => (
                <div key={index} className="safety-rating">
                  <strong>{rating.category}</strong>: {rating.probability}
                </div>
              ))}
            </div>
          )}

          {metadata.finishReason && (
            <div className="metadata-section">
              <h4>Completion</h4>
              <div>Reason: {metadata.finishReason}</div>
            </div>
          )}

          {metadata.hasNonTextParts && (
            <div className="metadata-section">
              <h4>Processing Notes</h4>
              <div>Response contained structured data beyond text</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MetadataDropdown; 