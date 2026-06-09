import { useState, useRef, useEffect } from "react";
import orionLogo from "../../../assets/orion-logo.png";

type Message = {
  id: string;
  text: string;
  sender: "user" | "ai";
};

type AgentStep = {
  id: string;
  text: string;
  status: "pending" | "loading" | "done";
};

export function ORIONWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hola, soy ORION. Estoy aquí para ayudarte rápido. ¿Qué necesitas?",
      sender: "ai",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isTyping, agentSteps, isOpen]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsTyping(true);

    const steps: AgentStep[] = [
      { id: "ws1", text: "Procesando consulta rápida...", status: "pending" },
    ];
    setAgentSteps(steps);

    setTimeout(() => {
      setAgentSteps([{ id: "ws1", text: "Procesando consulta rápida...", status: "loading" }]);
    }, 200);

    setTimeout(() => {
      setAgentSteps([]);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        text: "Respuesta rápida de ORION desde el Widget. (En Fase 2 compartiremos la memoria con la pantalla principal).",
        sender: "ai",
      };
      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`orion-widget-container ${isOpen ? "open" : ""}`}>
      {/* Ventana de Chat */}
      <div className={`orion-widget-window ${isOpen ? "visible" : "hidden"}`}>
        <header className="orion-widget-header">
          <div className="orion-widget-header-title">
            <img src={orionLogo} alt="ORION Logo" style={{ width: "24px", height: "24px", objectFit: "contain" }} />
            <div>
              <h3>ORION</h3>
              <p>Asistente Rápido</p>
            </div>
          </div>
          <button className="orion-widget-close" onClick={() => setIsOpen(false)} aria-label="Cerrar widget">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div className="orion-widget-chat-area">
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
          <div ref={messagesEndRef} />
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
        className={`orion-widget-fab ${isOpen ? "hidden" : ""}`}
        onClick={() => setIsOpen(true)}
        aria-label="Abrir ORION"
      >
        <img src={orionLogo} alt="ORION" />
      </button>
    </div>
  );
}
