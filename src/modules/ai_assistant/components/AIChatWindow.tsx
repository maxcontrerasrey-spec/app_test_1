import { useState, useRef, useEffect } from "react";
import { useORION } from "../context/ORIONContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function AIChatWindow() {
  const [inputValue, setInputValue] = useState("");
  const { agentSteps, isTyping, messages, sendMessage } = useORION();
  const chatAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTo({
        top: chatAreaRef.current.scrollHeight,
        behavior: "smooth"
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, agentSteps]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue, "full");
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="orion-main">
      <header className="orion-header">
        <div className="orion-header-text">
          <h2>ORION</h2>
          <p>Cerebro Llama 3 · Listo para ayudarte</p>
        </div>
      </header>

      <div className="orion-chat-area" ref={chatAreaRef}>
        <div className="orion-chat-content">
          {messages.map((msg) => (
            <div key={msg.id} className={`orion-message ${msg.sender}`}>
              <div className="orion-message-content orion-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          ))}
          
          {/* Agentic Thinking UI */}
          {isTyping && (
            <div className="orion-agent-steps">
              {agentSteps.map((step) => {
                if (step.status === "pending") return null;
                return (
                  <div key={step.id} className={`orion-agent-step ${step.status}`}>
                    <div className="orion-step-icon">
                      {step.status === "loading" ? (
                        <div className="orion-spinner"></div>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                    <span className="orion-step-text">{step.text}</span>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      <div className="orion-input-area">
        <div className="orion-input-wrapper">
          <button className="orion-attach-btn" aria-label="Adjuntar documento para esta sesión" title="Adjuntar archivo temporal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
          </button>
          <textarea
            className="orion-input"
            placeholder="Pregúntale a ORION sobre procedimientos, manuales o dudas operativas..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button 
            className="orion-send-btn" 
            onClick={handleSend}
            disabled={!inputValue.trim() || isTyping}
            aria-label="Enviar mensaje"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
