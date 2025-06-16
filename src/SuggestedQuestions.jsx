import React, { useRef, useEffect, useState } from 'react';

const SuggestedQuestions = ({ suggestedQuestions, handleQuestionClick }) => {
  const questionsRef = useRef(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      if (questionsRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = questionsRef.current;
        setShowLeftScroll(scrollLeft > 0);
        setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    checkScroll();
    questionsRef.current?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);

    return () => {
      questionsRef.current?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, []);

  const scroll = (direction) => {
    if (questionsRef.current) {
      const questionElements = questionsRef.current.children;
      if (questionElements.length > 0) {
        const questionWidth = questionElements[0].offsetWidth + 8;
        questionsRef.current.scrollBy({
          left: direction === 'left' ? -questionWidth : questionWidth,
          behavior: 'smooth'
        });
      }
    }
  };

  return (
    <div className="suggested-questions-container">
      {showLeftScroll && (
        <button
          className="scroll-button scroll-button-left"
          onClick={() => scroll('left')}
          aria-label="Scroll left"
        >
          ◀
        </button>
      )}
      <div ref={questionsRef} className="suggested-questions">
        {suggestedQuestions.map((question, index) => (
          <button
            key={index}
            className="question-pill"
            onClick={() => handleQuestionClick(question)}
          >
            {question}
          </button>
        ))}
      </div>
      {showRightScroll && (
        <button
          className="scroll-button scroll-button-right"
          onClick={() => scroll('right')}
          aria-label="Scroll right"
        >
          ▶
        </button>
      )}
    </div>
  );
};

export default SuggestedQuestions;