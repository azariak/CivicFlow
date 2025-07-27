import React from "react";

const LoadingAnimation = () => {
  return (
    <div className="loading-animation-container">
      <div className="loading-animation">
        <div className="loading-header">
          <div className="loading-logo-container">
            <img 
              src="/TorontoLogo.svg" 
              alt="Toronto Logo" 
              className="loading-toronto-logo"
            />
          </div>
          <div className="loading-text-container">
            <div className="loading-title">Querying the City of Toronto database</div>
            <div className="loading-subtitle">Searching through open data sources...</div>
          </div>
        </div>
        <div className="loading-dots">
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
          <div className="loading-dot"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingAnimation; 