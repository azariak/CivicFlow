import React from 'react';
import { HelpContent } from './helpContent';

export function HelpPopup({ isOpen, onClose }) {
  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="popup-overlay" onClick={handleOverlayClick} role="dialog">
      <div className="popup">
        <button className="popup-close" onClick={onClose}>×</button>
        <h2 className="popup-title">How to Use CivicFlowTO</h2>
        <HelpContent />
      </div>
    </div>
  );
}
