import { useState, useRef, useEffect } from "react";
import orionLogo from "../../../assets/orion-logo.png";
import { useORION } from "../context/ORIONContext";
import "../styles/ai-assistant.css";
import "../styles/orion-widget.css";

export function ORIONWidget() {
  const [inputValue, setInputValue] = useState("");
  const {
    agentSteps,
    closeWidget,
    isTyping,
    isWidgetOpen,
    messages,
    openWidget,
    sendMessage
  } = useORION();
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
    if (isWidgetOpen) {
      scrollToBottom();
    }
  }, [agentSteps, isTyping, isWidgetOpen, messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    sendMessage(inputValue, "widget");
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`orion-widget-container ${isWidgetOpen ? "open" : ""}`}>
      {/* Ventana de Chat */}
      <div className={`orion-widget-window ${isWidgetOpen ? "visible" : "hidden"}`}>
        <header className="orion-widget-header">
          <div className="orion-widget-header-title">
            <img src={orionLogo} alt="ORION Logo" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
            <div>
              <h3>ORION</h3>
              <p>Asistente Rápido</p>
            </div>
          </div>
          <button className="orion-widget-close" onClick={closeWidget} aria-label="Cerrar widget">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div className="orion-widget-chat-area" ref={chatAreaRef}>
          {messages.map((msg) => (
            <div key={msg.id} className={`orion-message ${msg.sender}`}>
              <div className="orion-message-content">
                {msg.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="orion-agent-steps widget-steps">
              {agentSteps.map((step) => {
                if (step.status === "pending") return null;
                return (
                  <div key={step.id} className={`orion-agent-step ${step.status}`}>
                    <div className="orion-step-icon">
                      <div className="orion-spinner"></div>
                    </div>
                    <span className="orion-step-text">{step.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="orion-widget-input-area">
          <div className="orion-input-wrapper">
            <textarea
              className="orion-input"
              placeholder="Pregunta algo rápido..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button 
              className="orion-send-btn" 
              onClick={handleSend}
              disabled={!inputValue.trim() || isTyping}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Botón Flotante (FAB) */}
      <button 
        className={`orion-widget-fab ${isWidgetOpen ? "hidden" : ""}`}
        onClick={openWidget}
        aria-label="Abrir ORION"
      >
        <img src={orionLogo} alt="ORION" />
      </button>
    </div>
  );
}
